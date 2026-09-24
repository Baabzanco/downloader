import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AdminRepository } from '../models/adminRepository.js';
import { AdminSession, AdminUserPublic } from '../models/types.js';
import { AuditService } from '../services/auditService.js';
import { LoginRateLimiter } from './rateLimiter.js';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const COOKIE_NAME = 'admin_session';

export class AuthService {
  public static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  public static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  public static generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  public static async login(params: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ user: AdminUserPublic; session: AdminSession; token: string }> {
    const emailNorm = params.email.toLowerCase().trim();
    const rateLimitKey = `login:${params.ipAddress || 'unknown'}:${emailNorm}`;

    // Rate limiting check
    const lockStatus = LoginRateLimiter.isLocked(rateLimitKey);
    if (lockStatus.locked) {
      AuditService.log({
        actorEmail: emailNorm,
        action: 'LOGIN_RATE_LIMITED',
        resourceType: 'auth',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: { remainingSeconds: lockStatus.remainingSeconds },
      });
      throw new Error(`Too many failed login attempts. Please wait ${lockStatus.remainingSeconds} seconds before trying again.`);
    }

    const user = AdminRepository.findByEmail(emailNorm);
    if (!user) {
      LoginRateLimiter.recordFailure(rateLimitKey);
      AuditService.log({
        actorEmail: emailNorm,
        action: 'LOGIN_FAILED_NONEXISTENT_USER',
        resourceType: 'auth',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw new Error('Invalid email or password.');
    }

    if (user.status !== 'active') {
      AuditService.log({
        actorAdminUserId: user.id,
        actorEmail: user.email,
        action: 'LOGIN_FAILED_DISABLED_USER',
        resourceType: 'auth',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw new Error('Your administrative account has been deactivated. Please contact an administrator.');
    }

    const isMatch = await this.comparePassword(params.password, user.passwordHash);
    if (!isMatch) {
      const failResult = LoginRateLimiter.recordFailure(rateLimitKey);
      AuditService.log({
        actorAdminUserId: user.id,
        actorEmail: user.email,
        action: 'LOGIN_FAILED_INVALID_PASSWORD',
        resourceType: 'auth',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: { remainingAttempts: failResult.remainingAttempts },
      });
      throw new Error('Invalid email or password.');
    }

    // Success - reset rate limiter
    LoginRateLimiter.recordSuccess(rateLimitKey);

    // Create session (protecting against session fixation with crypto token)
    const token = this.generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

    const session: AdminSession = {
      id: token,
      adminUserId: user.id,
      expiresAt,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
    };

    AdminRepository.createSession(session);
    AdminRepository.recordLogin(user.id);

    AuditService.log({
      actorAdminUserId: user.id,
      actorEmail: user.email,
      action: 'LOGIN_SUCCESS',
      resourceType: 'auth',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    const publicUser = AdminRepository.getPublicUser(user.id);
    if (!publicUser) throw new Error('Failed to retrieve user after login.');

    return { user: publicUser, session, token };
  }

  public static logout(token: string, ipAddress?: string, userAgent?: string): void {
    const session = AdminRepository.getSession(token);
    if (session) {
      AdminRepository.revokeSession(token);
      const user = AdminRepository.findById(session.adminUserId);
      AuditService.log({
        actorAdminUserId: session.adminUserId,
        actorEmail: user?.email,
        action: 'LOGOUT',
        resourceType: 'auth',
        ipAddress,
        userAgent,
      });
    }
  }

  public static verifySession(token: string): { user: AdminUserPublic; session: AdminSession } | null {
    if (!token || typeof token !== 'string') return null;

    const session = AdminRepository.getSession(token);
    if (!session) return null;

    // Check revoked
    if (session.revokedAt) return null;

    // Check expired
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    const user = AdminRepository.getPublicUser(session.adminUserId);
    if (!user || user.status !== 'active') {
      return null;
    }

    // Touch session for activity tracking
    AdminRepository.touchSession(token);

    return { user, session };
  }
}

import { Request, Response, NextFunction } from 'express';
import { AuthService, COOKIE_NAME } from '../auth/authService.js';
import { AdminUserPublic, AdminSession } from '../models/types.js';

// Extend Express Request interface to hold authenticated admin user
declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUserPublic;
      adminSession?: AdminSession;
      adminToken?: string;
    }
  }
}

export function extractSessionToken(req: Request): string | null {
  // 1. Check cookies (via cookie-parser or parsed headers)
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }

  // Fallback: parse raw Cookie header if cookie-parser wasn't triggered
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`(^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (match) {
      return decodeURIComponent(match[2]);
    }
  }

  // 2. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

export async function adminAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractSessionToken(req);
  if (token) {
    const verified = AuthService.verifySession(token);
    if (verified) {
      req.adminUser = verified.user;
      req.adminSession = verified.session;
      req.adminToken = token;
    }
  }
  next();
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.adminUser) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required. Please log in with an administrative session.',
      },
    });
    return;
  }
  next();
}

export function requirePermission(permissionKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.adminUser) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Please log in with an administrative session.',
        },
      });
      return;
    }

    // SUPER_ADMIN role bypasses all permission checks
    const isSuperAdmin = req.adminUser.roles.some((r) => r.name === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return next();
    }

    if (!req.adminUser.permissions.includes(permissionKey)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions: missing "${permissionKey}".`,
        },
      });
      return;
    }

    next();
  };
}

export function requireRole(roleName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.adminUser) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    const hasRole = req.adminUser.roles.some((r) => r.name === roleName || r.name === 'SUPER_ADMIN');
    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Role "${roleName}" is required to perform this action.`,
        },
      });
      return;
    }

    next();
  };
}

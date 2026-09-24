import { AdminRepository } from '../models/adminRepository.js';
import { AuditLog } from '../models/types.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'sessiontoken',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'api_key',
  'access_token',
  'refreshtoken',
]);

export function sanitizeMetadata(obj: unknown, depth = 0): any {
  if (depth > 5) return '[Truncated]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lower = key.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEYS.has(lower) || lower.includes('password') || lower.includes('secret') || lower.includes('token')) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = sanitizeMetadata(value, depth + 1);
      }
    }
    return clean;
  }

  return String(obj);
}

export class AuditService {
  public static log(entry: {
    actorAdminUserId?: string | null;
    actorEmail?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): AuditLog {
    const cleanMetadata = entry.metadata ? sanitizeMetadata(entry.metadata) : null;
    return AdminRepository.createAuditLog({
      ...entry,
      metadata: cleanMetadata,
    });
  }
}

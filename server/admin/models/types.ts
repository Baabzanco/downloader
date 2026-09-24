export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface AdminUserPublic {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
  roles: Role[];
  permissions: string[];
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  key: string;
  description?: string | null;
  category: string;
  createdAt: string;
}

export interface AdminSession {
  id: string;
  adminUserId: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string | null;
  lastSeenAt: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface AuditLog {
  id: string;
  actorAdminUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AdminSetting {
  key: string;
  value: string;
  description?: string | null;
  isSecret: boolean;
  category: string;
  updatedAt: string;
  updatedBy?: string | null;
}

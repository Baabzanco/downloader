import { getDatabase } from '../../db/database.js';
import {
  AdminUser,
  AdminUserPublic,
  Role,
  Permission,
  AdminSession,
  AuditLog,
  AdminSetting,
} from './types.js';
import crypto from 'crypto';

export class AdminRepository {
  // -------------------------------------------------------------
  // USER METHODS
  // -------------------------------------------------------------
  public static findByEmail(email: string): AdminUser | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM admin_users WHERE email = ? COLLATE NOCASE');
    const row = stmt.get(email) as any;
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
    };
  }

  public static findById(id: string): AdminUser | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM admin_users WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
    };
  }

  public static getPublicUser(id: string): AdminUserPublic | null {
    const user = this.findById(id);
    if (!user) return null;

    const roles = this.getRolesForUser(id);
    const permissions = this.getPermissionsForUser(id);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      roles,
      permissions,
    };
  }

  public static listUsers(options?: {
    search?: string;
    status?: string;
    roleId?: string;
    limit?: number;
    offset?: number;
  }): { users: AdminUserPublic[]; total: number } {
    const db = getDatabase();
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = 'SELECT DISTINCT u.* FROM admin_users u';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.roleId) {
      query += ' JOIN admin_user_roles ur ON u.id = ur.admin_user_id';
      conditions.push('ur.role_id = ?');
      params.push(options.roleId);
    }

    if (options?.search) {
      conditions.push('(u.email LIKE ? OR u.name LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    if (options?.status) {
      conditions.push('u.status = ?');
      params.push(options.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM (${query})`;
    const countRow = db.prepare(countQuery).get(...params) as any;
    const total = Number(countRow?.count || 0);

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params) as any[];
    const users: AdminUserPublic[] = rows.map((row) => {
      const roles = this.getRolesForUser(row.id);
      const permissions = this.getPermissionsForUser(row.id);
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastLoginAt: row.last_login_at,
        roles,
        permissions,
      };
    });

    return { users, total };
  }

  public static createUser(
    userData: {
      id: string;
      email: string;
      passwordHash: string;
      name: string;
      status?: 'active' | 'disabled';
    },
    roleIds: string[]
  ): AdminUserPublic {
    const db = getDatabase();
    const now = new Date().toISOString();
    const status = userData.status || 'active';

    const insertUser = db.prepare(`
      INSERT INTO admin_users (id, email, password_hash, name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(
      userData.id,
      userData.email.toLowerCase().trim(),
      userData.passwordHash,
      userData.name.trim(),
      status,
      now,
      now
    );

    const insertRole = db.prepare(
      'INSERT INTO admin_user_roles (admin_user_id, role_id) VALUES (?, ?)'
    );
    for (const rId of roleIds) {
      insertRole.run(userData.id, rId);
    }

    const created = this.getPublicUser(userData.id);
    if (!created) throw new Error('Failed to retrieve newly created user');
    return created;
  }

  public static updateUser(
    id: string,
    updates: Partial<{
      name: string;
      email: string;
      status: 'active' | 'disabled';
      passwordHash: string;
    }>,
    roleIds?: string[]
  ): AdminUserPublic {
    const db = getDatabase();
    const now = new Date().toISOString();

    const setClauses: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      params.push(updates.name.trim());
    }
    if (updates.email !== undefined) {
      setClauses.push('email = ?');
      params.push(updates.email.toLowerCase().trim());
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }
    if (updates.passwordHash !== undefined) {
      setClauses.push('password_hash = ?');
      params.push(updates.passwordHash);
    }

    params.push(id);
    const updateSql = `UPDATE admin_users SET ${setClauses.join(', ')} WHERE id = ?`;
    db.prepare(updateSql).run(...params);

    if (roleIds !== undefined) {
      db.prepare('DELETE FROM admin_user_roles WHERE admin_user_id = ?').run(id);
      const insertRole = db.prepare(
        'INSERT INTO admin_user_roles (admin_user_id, role_id) VALUES (?, ?)'
      );
      for (const rId of roleIds) {
        insertRole.run(id, rId);
      }
    }

    const updated = this.getPublicUser(id);
    if (!updated) throw new Error('Failed to retrieve updated user');
    return updated;
  }

  public static deleteUser(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
  }

  public static countActiveSuperAdmins(): number {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT COUNT(DISTINCT u.id) as count
         FROM admin_users u
         JOIN admin_user_roles ur ON u.id = ur.admin_user_id
         JOIN roles r ON ur.role_id = r.id
         WHERE r.name = 'SUPER_ADMIN' AND u.status = 'active'`
      )
      .get() as any;
    return Number(row?.count || 0);
  }

  public static recordLogin(userId: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(now, userId);
  }

  // -------------------------------------------------------------
  // ROLES & PERMISSIONS
  // -------------------------------------------------------------
  public static listRoles(): (Role & { userCount: number; permissionCount: number })[] {
    const db = getDatabase();
    const roles = db.prepare('SELECT * FROM roles ORDER BY is_system DESC, name ASC').all() as any[];

    return roles.map((r) => {
      const userCountRow = db
        .prepare('SELECT COUNT(*) as count FROM admin_user_roles WHERE role_id = ?')
        .get(r.id) as any;
      const permCountRow = db
        .prepare('SELECT COUNT(*) as count FROM role_permissions WHERE role_id = ?')
        .get(r.id) as any;

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: Boolean(r.is_system),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        userCount: Number(userCountRow?.count || 0),
        permissionCount: Number(permCountRow?.count || 0),
      };
    });
  }

  public static getRoleById(id: string): (Role & { permissions: Permission[] }) | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as any;
    if (!r) return null;

    const perms = db
      .prepare(
        `SELECT p.* FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id = ?
         ORDER BY p.category ASC, p.key ASC`
      )
      .all(id) as any[];

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: Boolean(r.is_system),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      permissions: perms.map((p) => ({
        id: p.id,
        key: p.key,
        description: p.description,
        category: p.category,
        createdAt: p.created_at,
      })),
    };
  }

  public static getRoleByName(name: string): Role | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM roles WHERE name = ?').get(name) as any;
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: Boolean(r.is_system),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public static createRole(
    data: { id: string; name: string; description?: string; isSystem?: boolean },
    permissionKeys: string[]
  ): Role & { permissions: Permission[] } {
    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.id, data.name.toUpperCase().trim(), data.description || null, data.isSystem ? 1 : 0, now, now);

    const insertRolePerm = db.prepare(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
    );

    for (const key of permissionKeys) {
      const perm = db.prepare('SELECT id FROM permissions WHERE key = ?').get(key) as any;
      if (perm) {
        insertRolePerm.run(data.id, perm.id);
      }
    }

    const created = this.getRoleById(data.id);
    if (!created) throw new Error('Failed to retrieve newly created role');
    return created;
  }

  public static updateRole(
    id: string,
    data: { name?: string; description?: string },
    permissionKeys?: string[]
  ): Role & { permissions: Permission[] } {
    const db = getDatabase();
    const now = new Date().toISOString();

    const setClauses: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (data.name !== undefined) {
      setClauses.push('name = ?');
      params.push(data.name.toUpperCase().trim());
    }
    if (data.description !== undefined) {
      setClauses.push('description = ?');
      params.push(data.description);
    }

    params.push(id);
    db.prepare(`UPDATE roles SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    if (permissionKeys !== undefined) {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);
      const insertRolePerm = db.prepare(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
      );
      for (const key of permissionKeys) {
        const perm = db.prepare('SELECT id FROM permissions WHERE key = ?').get(key) as any;
        if (perm) {
          insertRolePerm.run(id, perm.id);
        }
      }
    }

    const updated = this.getRoleById(id);
    if (!updated) throw new Error('Failed to retrieve updated role');
    return updated;
  }

  public static listPermissions(): Permission[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM permissions ORDER BY category ASC, key ASC').all() as any[];
    return rows.map((p) => ({
      id: p.id,
      key: p.key,
      description: p.description,
      category: p.category,
      createdAt: p.created_at,
    }));
  }

  public static getRolesForUser(userId: string): Role[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT r.* FROM roles r
         JOIN admin_user_roles ur ON r.id = ur.role_id
         WHERE ur.admin_user_id = ?
         ORDER BY r.is_system DESC, r.name ASC`
      )
      .all(userId) as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: Boolean(r.is_system),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public static getPermissionsForUser(userId: string): string[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT DISTINCT p.key FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         JOIN admin_user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.admin_user_id = ?
         ORDER BY p.key ASC`
      )
      .all(userId) as any[];

    return rows.map((r) => r.key);
  }

  // -------------------------------------------------------------
  // SESSIONS
  // -------------------------------------------------------------
  public static createSession(session: AdminSession): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO admin_sessions (id, admin_user_id, expires_at, created_at, revoked_at, last_seen_at, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.adminUserId,
      session.expiresAt,
      session.createdAt,
      session.revokedAt || null,
      session.lastSeenAt,
      session.userAgent || null,
      session.ipAddress || null
    );
  }

  public static getSession(id: string): AdminSession | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM admin_sessions WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      adminUserId: row.admin_user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
      lastSeenAt: row.last_seen_at,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
    };
  }

  public static touchSession(id: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare('UPDATE admin_sessions SET last_seen_at = ? WHERE id = ?').run(now, id);
  }

  public static revokeSession(id: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE id = ?').run(now, id);
  }

  public static revokeAllUserSessions(userId: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE admin_user_id = ? AND revoked_at IS NULL').run(
      now,
      userId
    );
  }

  public static cleanupExpiredSessions(): number {
    const db = getDatabase();
    const now = new Date().toISOString();
    const result = db.prepare('DELETE FROM admin_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL').run(now);
    return Number(result.changes || 0);
  }

  // -------------------------------------------------------------
  // AUDIT LOGS
  // -------------------------------------------------------------
  public static createAuditLog(log: {
    actorAdminUserId?: string | null;
    actorEmail?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): AuditLog {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const metadataStr = log.metadata ? JSON.stringify(log.metadata) : null;

    db.prepare(`
      INSERT INTO audit_logs (id, actor_admin_user_id, actor_email, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      log.actorAdminUserId || null,
      log.actorEmail || null,
      log.action,
      log.resourceType,
      log.resourceId || null,
      metadataStr,
      log.ipAddress || null,
      log.userAgent || null,
      now
    );

    return {
      id,
      actorAdminUserId: log.actorAdminUserId,
      actorEmail: log.actorEmail,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: now,
    };
  }

  public static listAuditLogs(options?: {
    action?: string;
    resourceType?: string;
    actorId?: string;
    limit?: number;
    offset?: number;
  }): { logs: AuditLog[]; total: number } {
    const db = getDatabase();
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = 'SELECT * FROM audit_logs';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.action) {
      conditions.push('action = ?');
      params.push(options.action);
    }
    if (options?.resourceType) {
      conditions.push('resource_type = ?');
      params.push(options.resourceType);
    }
    if (options?.actorId) {
      conditions.push('actor_admin_user_id = ?');
      params.push(options.actorId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const countQuery = `SELECT COUNT(*) as count FROM (${query})`;
    const countRow = db.prepare(countQuery).get(...params) as any;
    const total = Number(countRow?.count || 0);

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params) as any[];
    const logs: AuditLog[] = rows.map((r) => {
      let parsedMetadata: Record<string, unknown> | null = null;
      if (r.metadata) {
        try {
          parsedMetadata = JSON.parse(r.metadata);
        } catch {}
      }
      return {
        id: r.id,
        actorAdminUserId: r.actor_admin_user_id,
        actorEmail: r.actor_email,
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        metadata: parsedMetadata,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        createdAt: r.created_at,
      };
    });

    return { logs, total };
  }

  // -------------------------------------------------------------
  // SETTINGS
  // -------------------------------------------------------------
  public static getSettings(): AdminSetting[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM admin_settings ORDER BY category ASC, key ASC').all() as any[];
    return rows.map((r) => ({
      key: r.key,
      value: Boolean(r.is_secret) ? '••••••••' : r.value,
      description: r.description,
      isSecret: Boolean(r.is_secret),
      category: r.category,
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    }));
  }

  public static getSettingRaw(key: string): AdminSetting | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM admin_settings WHERE key = ?').get(key) as any;
    if (!r) return null;
    return {
      key: r.key,
      value: r.value,
      description: r.description,
      isSecret: Boolean(r.is_secret),
      category: r.category,
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    };
  }

  public static upsertSetting(
    key: string,
    value: string,
    description?: string,
    isSecret?: boolean,
    category?: string,
    updatedBy?: string
  ): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO admin_settings (key, value, description, is_secret, category, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        description = COALESCE(excluded.description, admin_settings.description),
        is_secret = COALESCE(excluded.is_secret, admin_settings.is_secret),
        category = COALESCE(excluded.category, admin_settings.category),
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `).run(
      key,
      value,
      description || null,
      isSecret ? 1 : 0,
      category || 'general',
      now,
      updatedBy || null
    );
  }
}

import { Router, Request, Response } from 'express';
import { AdminRepository } from '../models/adminRepository.js';
import { AuthService } from '../auth/authService.js';
import { AuditService } from '../services/auditService.js';
import { requireAdminAuth, requirePermission } from '../middleware/adminAuth.js';
import crypto from 'crypto';

export const adminUserRouter = Router();

// All user routes require base authentication
adminUserRouter.use(requireAdminAuth);

/**
 * GET /api/admin/users
 */
adminUserRouter.get('/', requirePermission('admin.users.read'), (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;
  const roleId = req.query.roleId as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;

  const result = AdminRepository.listUsers({ search, status, roleId, limit, offset });
  res.json({
    success: true,
    users: result.users,
    total: result.total,
    limit,
    offset,
  });
});

/**
 * GET /api/admin/users/:id
 */
adminUserRouter.get('/:id', requirePermission('admin.users.read'), (req: Request, res: Response) => {
  const user = AdminRepository.getPublicUser(req.params.id);
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Administrator not found.' },
    });
    return;
  }
  res.json({ success: true, user });
});

/**
 * POST /api/admin/users
 */
adminUserRouter.post('/', requirePermission('admin.users.write'), async (req: Request, res: Response) => {
  try {
    const { name, email, password, roleIds, status } = req.body || {};

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, email, and password are required.' },
      });
      return;
    }

    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 8 characters long.' },
      });
      return;
    }

    const emailNorm = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Invalid email address format.' },
      });
      return;
    }

    const existing = AdminRepository.findByEmail(emailNorm);
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'An administrator with this email already exists.' },
      });
      return;
    }

    // Role validation & privilege escalation prevention
    const rolesToAssign: string[] = Array.isArray(roleIds) ? roleIds : [];
    const callerIsSuperAdmin = req.adminUser!.roles.some((r) => r.name === 'SUPER_ADMIN');

    const superAdminRole = AdminRepository.getRoleByName('SUPER_ADMIN');
    if (superAdminRole && rolesToAssign.includes(superAdminRole.id) && !callerIsSuperAdmin) {
      res.status(403).json({
        success: false,
        error: { code: 'PRIVILEGE_ESCALATION', message: 'Only a Super Administrator can assign the SUPER_ADMIN role.' },
      });
      return;
    }

    const passwordHash = await AuthService.hashPassword(password);
    const newUserId = crypto.randomUUID();

    const created = AdminRepository.createUser(
      {
        id: newUserId,
        email: emailNorm,
        passwordHash,
        name: name.trim(),
        status: status === 'disabled' ? 'disabled' : 'active',
      },
      rolesToAssign
    );

    AuditService.log({
      actorAdminUserId: req.adminUser!.id,
      actorEmail: req.adminUser!.email,
      action: 'ADMIN_USER_CREATED',
      resourceType: 'admin_user',
      resourceId: created.id,
      metadata: { email: created.email, name: created.name, roles: created.roles.map((r) => r.name) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, user: created });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to create user.' },
    });
  }
});

/**
 * PATCH /api/admin/users/:id
 */
adminUserRouter.patch('/:id', requirePermission('admin.users.write'), async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const targetUser = AdminRepository.getPublicUser(targetId);

    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Administrator not found.' },
      });
      return;
    }

    const callerIsSuperAdmin = req.adminUser!.roles.some((r) => r.name === 'SUPER_ADMIN');
    const targetIsSuperAdmin = targetUser.roles.some((r) => r.name === 'SUPER_ADMIN');

    // Prevent non-super-admin from editing a super admin
    if (targetIsSuperAdmin && !callerIsSuperAdmin) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only a Super Administrator can modify another Super Administrator.' },
      });
      return;
    }

    const { name, email, status, roleIds, password } = req.body || {};
    const updates: any = {};

    if (name !== undefined) updates.name = String(name);
    if (email !== undefined) {
      const emailNorm = String(email).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_EMAIL', message: 'Invalid email address format.' },
        });
        return;
      }
      const existing = AdminRepository.findByEmail(emailNorm);
      if (existing && existing.id !== targetId) {
        res.status(409).json({
          success: false,
          error: { code: 'USER_EXISTS', message: 'Email address already in use by another administrator.' },
        });
        return;
      }
      updates.email = emailNorm;
    }

    // Protection against deactivating the last active SUPER_ADMIN
    if (status !== undefined) {
      if (status === 'disabled' && targetIsSuperAdmin && AdminRepository.countActiveSuperAdmins() <= 1) {
        res.status(400).json({
          success: false,
          error: {
            code: 'LAST_SUPER_ADMIN_PROTECTED',
            message: 'Cannot deactivate the last remaining active Super Administrator.',
          },
        });
        return;
      }
      updates.status = status === 'disabled' ? 'disabled' : 'active';
    }

    // Role assignment checks
    let assignedRoleIds: string[] | undefined = undefined;
    if (roleIds !== undefined && Array.isArray(roleIds)) {
      const superAdminRole = AdminRepository.getRoleByName('SUPER_ADMIN');
      const assigningSuperAdmin = superAdminRole && roleIds.includes(superAdminRole.id);

      if (assigningSuperAdmin && !callerIsSuperAdmin) {
        res.status(403).json({
          success: false,
          error: { code: 'PRIVILEGE_ESCALATION', message: 'Only a Super Administrator can assign the SUPER_ADMIN role.' },
        });
        return;
      }

      // If removing SUPER_ADMIN from target, check if they are the last one
      if (targetIsSuperAdmin && !assigningSuperAdmin && AdminRepository.countActiveSuperAdmins() <= 1) {
        res.status(400).json({
          success: false,
          error: {
            code: 'LAST_SUPER_ADMIN_PROTECTED',
            message: 'Cannot revoke SUPER_ADMIN role from the last remaining active Super Administrator.',
          },
        });
        return;
      }

      assignedRoleIds = roleIds;
    }

    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 8) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 8 characters long.' },
        });
        return;
      }
      updates.passwordHash = await AuthService.hashPassword(password);
      // Revoke all previous active sessions on password change
      AdminRepository.revokeAllUserSessions(targetId);
    }

    const updated = AdminRepository.updateUser(targetId, updates, assignedRoleIds);

    AuditService.log({
      actorAdminUserId: req.adminUser!.id,
      actorEmail: req.adminUser!.email,
      action: 'ADMIN_USER_UPDATED',
      resourceType: 'admin_user',
      resourceId: updated.id,
      metadata: {
        updatedFields: Object.keys(updates).filter((k) => k !== 'passwordHash'),
        passwordReset: Boolean(password),
        roles: updated.roles.map((r) => r.name),
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to update user.' },
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 */
adminUserRouter.delete('/:id', requirePermission('admin.users.write'), (req: Request, res: Response) => {
  const targetId = req.params.id;
  const targetUser = AdminRepository.getPublicUser(targetId);

  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Administrator not found.' },
    });
    return;
  }

  const callerIsSuperAdmin = req.adminUser!.roles.some((r) => r.name === 'SUPER_ADMIN');
  const targetIsSuperAdmin = targetUser.roles.some((r) => r.name === 'SUPER_ADMIN');

  if (targetIsSuperAdmin && !callerIsSuperAdmin) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only a Super Administrator can delete another Super Administrator.' },
    });
    return;
  }

  // Prevent deleting the last SUPER_ADMIN
  if (targetIsSuperAdmin && AdminRepository.countActiveSuperAdmins() <= 1) {
    res.status(400).json({
      success: false,
      error: {
        code: 'LAST_SUPER_ADMIN_PROTECTED',
        message: 'Cannot delete the last remaining active Super Administrator.',
      },
    });
    return;
  }

  // Revoke active sessions and delete user
  AdminRepository.revokeAllUserSessions(targetId);
  AdminRepository.deleteUser(targetId);

  AuditService.log({
    actorAdminUserId: req.adminUser!.id,
    actorEmail: req.adminUser!.email,
    action: 'ADMIN_USER_DELETED',
    resourceType: 'admin_user',
    resourceId: targetId,
    metadata: { deletedEmail: targetUser.email, deletedName: targetUser.name },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'Administrator deleted successfully.' });
});

/**
 * POST /api/admin/users/:id/revoke-sessions
 */
adminUserRouter.post('/:id/revoke-sessions', requirePermission('admin.users.write'), (req: Request, res: Response) => {
  const targetId = req.params.id;
  AdminRepository.revokeAllUserSessions(targetId);

  AuditService.log({
    actorAdminUserId: req.adminUser!.id,
    actorEmail: req.adminUser!.email,
    action: 'ADMIN_SESSIONS_REVOKED',
    resourceType: 'admin_user',
    resourceId: targetId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'All active sessions for this user have been revoked.' });
});

import { Router, Request, Response } from 'express';
import { AdminRepository } from '../models/adminRepository.js';
import { AuditService } from '../services/auditService.js';
import { requireAdminAuth, requirePermission } from '../middleware/adminAuth.js';
import crypto from 'crypto';

export const adminRoleRouter = Router();

adminRoleRouter.use(requireAdminAuth);

/**
 * GET /api/admin/roles
 */
adminRoleRouter.get('/', requirePermission('admin.roles.read'), (_req: Request, res: Response) => {
  const roles = AdminRepository.listRoles();
  res.json({ success: true, roles });
});

/**
 * GET /api/admin/permissions
 */
adminRoleRouter.get('/permissions', requirePermission('admin.roles.read'), (_req: Request, res: Response) => {
  const permissions = AdminRepository.listPermissions();
  res.json({ success: true, permissions });
});

/**
 * GET /api/admin/roles/:id
 */
adminRoleRouter.get('/:id', requirePermission('admin.roles.read'), (req: Request, res: Response) => {
  const role = AdminRepository.getRoleById(req.params.id);
  if (!role) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Role not found.' },
    });
    return;
  }
  res.json({ success: true, role });
});

/**
 * POST /api/admin/roles
 */
adminRoleRouter.post('/', requirePermission('admin.roles.write'), (req: Request, res: Response) => {
  try {
    const { name, description, permissionKeys } = req.body || {};
    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Role name is required.' },
      });
      return;
    }

    const cleanName = name.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
    const existing = AdminRepository.getRoleByName(cleanName);
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'ROLE_EXISTS', message: 'A role with this name already exists.' },
      });
      return;
    }

    const roleId = `role_${cleanName.toLowerCase()}_${crypto.randomBytes(4).toString('hex')}`;
    const keys = Array.isArray(permissionKeys) ? permissionKeys : [];

    const created = AdminRepository.createRole(
      {
        id: roleId,
        name: cleanName,
        description: description ? String(description) : undefined,
      },
      keys
    );

    AuditService.log({
      actorAdminUserId: req.adminUser!.id,
      actorEmail: req.adminUser!.email,
      action: 'ROLE_CREATED',
      resourceType: 'role',
      resourceId: created.id,
      metadata: { name: created.name, permissionCount: created.permissions?.length || 0 },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, role: created });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to create role.' },
    });
  }
});

/**
 * PATCH /api/admin/roles/:id
 */
adminRoleRouter.patch('/:id', requirePermission('admin.roles.write'), (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const existing = AdminRepository.getRoleById(targetId);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Role not found.' },
      });
      return;
    }

    // Protect SUPER_ADMIN system role from modification
    if (existing.name === 'SUPER_ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'SYSTEM_ROLE_PROTECTED', message: 'The SUPER_ADMIN role cannot be modified.' },
      });
      return;
    }

    const { name, description, permissionKeys } = req.body || {};
    const updates: any = {};

    if (name !== undefined) {
      const cleanName = String(name).toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
      const conflict = AdminRepository.getRoleByName(cleanName);
      if (conflict && conflict.id !== targetId) {
        res.status(409).json({
          success: false,
          error: { code: 'ROLE_EXISTS', message: 'A role with this name already exists.' },
        });
        return;
      }
      updates.name = cleanName;
    }

    if (description !== undefined) {
      updates.description = String(description);
    }

    const keys = Array.isArray(permissionKeys) ? permissionKeys : undefined;
    const updated = AdminRepository.updateRole(targetId, updates, keys);

    AuditService.log({
      actorAdminUserId: req.adminUser!.id,
      actorEmail: req.adminUser!.email,
      action: 'ROLE_UPDATED',
      resourceType: 'role',
      resourceId: updated.id,
      metadata: { name: updated.name, permissionCount: updated.permissions?.length || 0 },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, role: updated });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to update role.' },
    });
  }
});

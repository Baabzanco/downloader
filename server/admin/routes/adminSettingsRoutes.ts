import { Router, Request, Response } from 'express';
import { AdminRepository } from '../models/adminRepository.js';
import { AuditService } from '../services/auditService.js';
import { requireAdminAuth, requirePermission } from '../middleware/adminAuth.js';

export const adminSettingsRouter = Router();

adminSettingsRouter.use(requireAdminAuth);

/**
 * GET /api/admin/settings
 */
adminSettingsRouter.get('/', requirePermission('settings.read'), (_req: Request, res: Response) => {
  const settings = AdminRepository.getSettings();
  res.json({ success: true, settings });
});

/**
 * PATCH /api/admin/settings
 */
adminSettingsRouter.patch('/', requirePermission('settings.write'), (req: Request, res: Response) => {
  try {
    const { key, value, description } = req.body || {};
    if (!key || typeof key !== 'string' || value === undefined) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Key and value are required.' },
      });
      return;
    }

    const existing = AdminRepository.getSettingRaw(key);
    AdminRepository.upsertSetting(
      key,
      String(value),
      description || existing?.description || undefined,
      existing?.isSecret || false,
      existing?.category || 'general',
      req.adminUser!.email
    );

    AuditService.log({
      actorAdminUserId: req.adminUser!.id,
      actorEmail: req.adminUser!.email,
      action: 'SETTING_UPDATED',
      resourceType: 'setting',
      resourceId: key,
      metadata: { key, isSecret: existing?.isSecret || false },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const settings = AdminRepository.getSettings();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to update setting.' },
    });
  }
});

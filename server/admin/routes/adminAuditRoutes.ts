import { Router, Request, Response } from 'express';
import { AdminRepository } from '../models/adminRepository.js';
import { requireAdminAuth, requirePermission } from '../middleware/adminAuth.js';

export const adminAuditRouter = Router();

adminAuditRouter.use(requireAdminAuth);

/**
 * GET /api/admin/audit-logs
 */
adminAuditRouter.get('/', requirePermission('audit.read'), (req: Request, res: Response) => {
  const action = req.query.action as string | undefined;
  const resourceType = req.query.resourceType as string | undefined;
  const actorId = req.query.actorId as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;

  const result = AdminRepository.listAuditLogs({
    action,
    resourceType,
    actorId,
    limit,
    offset,
  });

  res.json({
    success: true,
    logs: result.logs,
    total: result.total,
    limit,
    offset,
  });
});

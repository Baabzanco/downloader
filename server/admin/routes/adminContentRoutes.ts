/**
 * Admin Content Management Routes for Phase 8.3 Pages CMS
 */

import { Router, Request, Response } from 'express';
import { adminAuthMiddleware, requirePermission } from '../middleware/adminAuth.js';
import { ContentRepository } from '../models/contentRepository.js';
import {
  normalizeCmsPath,
  validatePathSecurity,
  validateSectionData,
  ContentValidationError,
} from '../services/contentValidationService.js';
import { AuditService } from '../services/auditService.js';
import {
  ContentPageStatus,
  ContentPageType,
  SectionType,
} from '../models/contentTypes.js';

export const adminContentRouter = Router();

// Enforce admin authentication across all CMS routes
adminContentRouter.use(adminAuthMiddleware);

/**
 * GET /api/admin/pages
 * List all CMS pages with optional filtering
 */
adminContentRouter.get(
  '/',
  requirePermission('content.pages.read'),
  async (req: Request, res: Response) => {
    try {
      const status = req.query.status as ContentPageStatus | undefined;
      const pageType = req.query.pageType as ContentPageType | undefined;
      const search = req.query.search as string | undefined;

      const pages = ContentRepository.listPages({ status, pageType, search });
      return res.json({ pages });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }
);

/**
 * GET /api/admin/pages/:id
 * Get single page with all its sections
 */
adminContentRouter.get(
  '/:id',
  requirePermission('content.pages.read'),
  async (req: Request, res: Response) => {
    try {
      const page = ContentRepository.getPageWithSections(req.params.id);
      if (!page) {
        return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'Page not found.' });
      }
      return res.json({ page });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }
);

/**
 * POST /api/admin/pages
 * Create a new content page
 */
adminContentRouter.post(
  '/',
  requirePermission('content.pages.write'),
  async (req: Request, res: Response) => {
    try {
      const { path: rawPath, title, pageType, status, sections } = req.body;

      if (!rawPath || typeof rawPath !== 'string') {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Path is required.' });
      }
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Title is required.' });
      }

      const normalizedPath = normalizeCmsPath(rawPath);
      validatePathSecurity(normalizedPath);

      // Check duplicate path
      const existing = ContentRepository.getPageByPath(normalizedPath);
      if (existing) {
        return res.status(409).json({
          error: 'DUPLICATE_PATH',
          message: `A page with path "${normalizedPath}" already exists.`,
        });
      }

      const validStatuses: ContentPageStatus[] = ['draft', 'published', 'archived'];
      const pageStatus: ContentPageStatus = validStatuses.includes(status) ? status : 'draft';

      const validTypes: ContentPageType[] = ['STATIC_PAGE', 'TOOL_PAGE', 'LANDING_PAGE'];
      const type: ContentPageType = validTypes.includes(pageType) ? pageType : 'TOOL_PAGE';

      const newPage = ContentRepository.createPage({
        path: normalizedPath,
        title: title.trim(),
        pageType: type,
        status: pageStatus,
        createdBy: req.adminUser?.id || null,
      });

      // If sections provided, validate and attach
      if (Array.isArray(sections)) {
        const validatedSections: any[] = [];
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          const validatedData = validateSectionData(s.sectionType, s.data);
          validatedSections.push({
            id: s.id,
            sectionType: s.sectionType,
            sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : i,
            data: validatedData,
            isVisible: s.isVisible !== false,
          });
        }
        ContentRepository.setSections(newPage.id, validatedSections);
      }

      AuditService.log({
        actorAdminUserId: req.adminUser?.id,
        actorEmail: req.adminUser?.email,
        action: 'page_created',
        resourceType: 'content_page',
        resourceId: newPage.id,
        metadata: { path: newPage.path, title: newPage.title, status: newPage.status },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      const fullPage = ContentRepository.getPageWithSections(newPage.id);
      return res.status(201).json({ page: fullPage });
    } catch (err: any) {
      if (err instanceof ContentValidationError) {
        return res.status(400).json({ error: err.code, message: err.message, details: err.details });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }
);

/**
 * PATCH /api/admin/pages/:id
 * Update an existing content page and sections
 */
adminContentRouter.patch(
  '/:id',
  requirePermission('content.pages.write'),
  handleUpdatePage
);
adminContentRouter.put(
  '/:id',
  requirePermission('content.pages.write'),
  handleUpdatePage
);

async function handleUpdatePage(req: Request, res: Response) {
    try {
      const pageId = req.params.id;
      const existing = ContentRepository.getPageById(pageId);
      if (!existing) {
        return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'Page not found.' });
      }

      // Whitelist writable fields
      const { path: rawPath, title, pageType, sections, status } = req.body;
      const updates: any = { updatedBy: req.adminUser?.id || null };

      if (rawPath !== undefined) {
        const normalized = normalizeCmsPath(rawPath);
        validatePathSecurity(normalized);

        // Check if collision with another page
        const other = ContentRepository.getPageByPath(normalized);
        if (other && other.id !== pageId) {
          return res.status(409).json({
            error: 'DUPLICATE_PATH',
            message: `A page with path "${normalized}" already exists.`,
          });
        }
        updates.path = normalized;
      }

      if (title !== undefined) {
        if (!title || typeof title !== 'string' || !title.trim()) {
          return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Title cannot be empty.' });
        }
        updates.title = title.trim();
      }

      if (pageType !== undefined) {
        const validTypes: ContentPageType[] = ['STATIC_PAGE', 'TOOL_PAGE', 'LANDING_PAGE'];
        if (!validTypes.includes(pageType)) {
          return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid page type.' });
        }
        updates.pageType = pageType;
      }

      if (status !== undefined) {
        const validStatuses: ContentPageStatus[] = ['draft', 'published', 'archived'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid page status.' });
        }
        updates.status = status;
      }

      ContentRepository.updatePage(pageId, updates);

      // If sections provided, validate and update
      if (Array.isArray(sections)) {
        const validatedSections: any[] = [];
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          const validatedData = validateSectionData(s.sectionType, s.data);
          validatedSections.push({
            id: s.id,
            sectionType: s.sectionType,
            sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : i,
            data: validatedData,
            isVisible: s.isVisible !== false,
          });
        }
        ContentRepository.setSections(pageId, validatedSections);
      }

      AuditService.log({
        actorAdminUserId: req.adminUser?.id,
        actorEmail: req.adminUser?.email,
        action: 'page_updated',
        resourceType: 'content_page',
        resourceId: pageId,
        metadata: { updates, sectionCount: Array.isArray(sections) ? sections.length : undefined },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      const fullPage = ContentRepository.getPageWithSections(pageId);
      return res.json({ page: fullPage });
    } catch (err: any) {
      if (err instanceof ContentValidationError) {
        return res.status(400).json({ error: err.code, message: err.message, details: err.details });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
}

/**
 * DELETE /api/admin/pages/:id
 * Delete a content page
 */
adminContentRouter.delete(
  '/:id',
  requirePermission('content.pages.delete'),
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params.id;
      const existing = ContentRepository.getPageById(pageId);
      if (!existing) {
        return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'Page not found.' });
      }

      ContentRepository.deletePage(pageId);

      AuditService.log({
        actorAdminUserId: req.adminUser?.id,
        actorEmail: req.adminUser?.email,
        action: 'page_deleted',
        resourceType: 'content_page',
        resourceId: pageId,
        metadata: { path: existing.path, title: existing.title },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.json({ success: true, message: 'Page deleted successfully.' });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }
);

/**
 * POST /api/admin/pages/:id/publish
 * Publish a page
 */
adminContentRouter.post(
  '/:id/publish',
  requirePermission('content.pages.publish'),
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params.id;
      const existing = ContentRepository.getPageById(pageId);
      if (!existing) {
        return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'Page not found.' });
      }

      const updated = ContentRepository.publishPage(pageId, req.adminUser?.id);

      AuditService.log({
        actorAdminUserId: req.adminUser?.id,
        actorEmail: req.adminUser?.email,
        action: 'page_published',
        resourceType: 'content_page',
        resourceId: pageId,
        metadata: { path: updated.path, title: updated.title },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      const fullPage = ContentRepository.getPageWithSections(pageId);
      return res.json({ page: fullPage });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }
);

/**
 * POST /api/admin/pages/:id/unpublish
 * Unpublish a page (moves to draft)
 */
adminContentRouter.post(
  '/:id/unpublish',
  requirePermission('content.pages.publish'),
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params.id;
      const existing = ContentRepository.getPageById(pageId);
      if (!existing) {
        return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'Page not found.' });
      }

      const updated = ContentRepository.unpublishPage(pageId, req.adminUser?.id);

      AuditService.log({
        actorAdminUserId: req.adminUser?.id,
        actorEmail: req.adminUser?.email,
        action: 'page_unpublished',
        resourceType: 'content_page',
        resourceId: pageId,
        metadata: { path: updated.path, title: updated.title },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      const fullPage = ContentRepository.getPageWithSections(pageId);
      return res.json({ page: fullPage });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }
);

/**
 * POST /api/admin/pages/:id/archive
 * Archive a page
 */
adminContentRouter.post(
  '/:id/archive',
  requirePermission('content.pages.write'),
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params.id;
      const existing = ContentRepository.getPageById(pageId);
      if (!existing) {
        return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'Page not found.' });
      }

      const updated = ContentRepository.archivePage(pageId, req.adminUser?.id);

      AuditService.log({
        actorAdminUserId: req.adminUser?.id,
        actorEmail: req.adminUser?.email,
        action: 'page_archived',
        resourceType: 'content_page',
        resourceId: pageId,
        metadata: { path: updated.path, title: updated.title },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      const fullPage = ContentRepository.getPageWithSections(pageId);
      return res.json({ page: fullPage });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }
);

/**
 * POST /api/admin/pages/:id/preview
 * Generate short-lived cryptographic preview token for draft preview
 */
adminContentRouter.post(
  '/:id/preview',
  requirePermission('content.pages.read'),
  async (req: Request, res: Response) => {
    try {
      const pageId = req.params.id;
      const page = ContentRepository.getPageById(pageId);
      if (!page) {
        return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'Page not found.' });
      }

      const tokenObj = ContentRepository.createPreviewToken(
        pageId,
        req.adminUser?.id || 'admin',
        60 // 60 minutes
      );

      const previewUrl = `${page.path}?previewToken=${tokenObj.token}`;
      return res.json({
        token: tokenObj.token,
        expiresAt: tokenObj.expiresAt,
        previewUrl,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }
);

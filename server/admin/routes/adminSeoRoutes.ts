import { Router, Request, Response } from 'express';
import { SeoRepository } from '../models/seoRepository.js';
import { SeoService, normalizePath, sanitizeUrl } from '../services/seoService.js';
import { requirePermission } from '../middleware/adminAuth.js';
import { AuditService } from '../services/auditService.js';
import crypto from 'crypto';

export const adminSeoRouter = Router();

/* ==========================================================================
 * 1. SEO PAGES
 * ========================================================================== */

// GET /api/admin/seo/pages - List all managed SEO pages
adminSeoRouter.get('/pages', requirePermission('seo.pages.read'), (_req: Request, res: Response) => {
  try {
    const pages = SeoRepository.listPages();
    return res.json({ success: true, pages });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_LIST_SEO_PAGES', message: error.message });
  }
});

// GET /api/admin/seo/pages/:id - Get single SEO page
adminSeoRouter.get('/pages/:id', requirePermission('seo.pages.read'), (req: Request, res: Response) => {
  try {
    const page = SeoRepository.getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'SEO page not found.' });
    }
    return res.json({ success: true, page });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_GET_SEO_PAGE', message: error.message });
  }
});

// POST /api/admin/seo/pages - Create new SEO page
adminSeoRouter.post('/pages', requirePermission('seo.pages.write'), (req: Request, res: Response) => {
  try {
    const {
      path,
      pageType,
      title,
      metaTitle,
      metaDescription,
      canonicalUrl,
      robotsIndex,
      robotsFollow,
      robotsExtra,
      h1,
      ogTitle,
      ogDescription,
      ogImage,
      ogType,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage,
      schemaType,
      schemaJson,
      sitemapIncluded,
      sitemapPriority,
      sitemapChangeFrequency,
      breadcrumbsJson,
      faqJson,
    } = req.body;

    if (!path || !title) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Path and title are required.' });
    }

    const normalizedPath = normalizePath(path);
    const existing = SeoRepository.getPageByPath(normalizedPath);
    if (existing) {
      return res.status(409).json({ error: 'PATH_EXISTS', message: `An SEO configuration for path "${normalizedPath}" already exists.` });
    }

    // Validate schemaJson if provided
    if (schemaJson && schemaJson.trim()) {
      try {
        JSON.parse(schemaJson);
      } catch {
        return res.status(400).json({ error: 'INVALID_SCHEMA_JSON', message: 'Structured data must be valid JSON syntax.' });
      }
    }

    const checkUnsafeScheme = (url?: string | null) => {
      if (!url || typeof url !== 'string') return false;
      const lower = url.trim().toLowerCase();
      return (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:')
      );
    };

    if (checkUnsafeScheme(canonicalUrl)) {
      return res.status(400).json({ error: 'INVALID_URL_SCHEME', message: 'Dangerous URI schemes are rejected in canonicalUrl.' });
    }
    if (checkUnsafeScheme(ogImage)) {
      return res.status(400).json({ error: 'INVALID_URL_SCHEME', message: 'Dangerous URI schemes are rejected in ogImage.' });
    }
    if (checkUnsafeScheme(twitterImage)) {
      return res.status(400).json({ error: 'INVALID_URL_SCHEME', message: 'Dangerous URI schemes are rejected in twitterImage.' });
    }

    const newPage = SeoRepository.upsertPage({
      id: crypto.randomUUID(),
      path: normalizedPath,
      pageType: pageType || 'TOOL_PAGE',
      title: title.trim(),
      metaTitle: metaTitle?.trim() || null,
      metaDescription: metaDescription?.trim() || null,
      canonicalUrl: sanitizeUrl(canonicalUrl) || null,
      robotsIndex: robotsIndex !== false,
      robotsFollow: robotsFollow !== false,
      robotsExtra: robotsExtra?.trim() || null,
      h1: h1?.trim() || null,
      ogTitle: ogTitle?.trim() || null,
      ogDescription: ogDescription?.trim() || null,
      ogImage: sanitizeUrl(ogImage) || null,
      ogType: ogType || 'website',
      twitterCard: twitterCard || 'summary_large_image',
      twitterTitle: twitterTitle?.trim() || null,
      twitterDescription: twitterDescription?.trim() || null,
      twitterImage: sanitizeUrl(twitterImage) || null,
      schemaType: schemaType || 'WebPage',
      schemaJson: schemaJson?.trim() || null,
      sitemapIncluded: sitemapIncluded !== false,
      sitemapPriority: typeof sitemapPriority === 'number' ? Math.max(0, Math.min(1, sitemapPriority)) : 0.8,
      sitemapChangeFrequency: sitemapChangeFrequency || 'weekly',
      breadcrumbsJson: breadcrumbsJson ? JSON.stringify(breadcrumbsJson) : null,
      faqJson: faqJson ? JSON.stringify(faqJson) : null,
    });

    AuditService.log({
      actorAdminUserId: req.adminUser?.id,
      actorEmail: req.adminUser?.email,
      action: 'SEO_PAGE_CREATED',
      resourceType: 'seo_page',
      resourceId: newPage.id,
      metadata: { path: newPage.path, title: newPage.title },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({ success: true, page: newPage });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_CREATE_SEO_PAGE', message: error.message });
  }
});

// PATCH /api/admin/seo/pages/:id - Update SEO page
adminSeoRouter.patch('/pages/:id', requirePermission('seo.pages.write'), (req: Request, res: Response) => {
  try {
    const existing = SeoRepository.getPageById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'SEO page not found.' });
    }

    const {
      title,
      metaTitle,
      metaDescription,
      canonicalUrl,
      robotsIndex,
      robotsFollow,
      robotsExtra,
      h1,
      ogTitle,
      ogDescription,
      ogImage,
      ogType,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage,
      schemaType,
      schemaJson,
      sitemapIncluded,
      sitemapPriority,
      sitemapChangeFrequency,
      breadcrumbsJson,
      faqJson,
      pageType,
    } = req.body;

    // Validate schemaJson if updated
    if (schemaJson !== undefined && schemaJson !== null && schemaJson.trim()) {
      try {
        JSON.parse(schemaJson);
      } catch {
        return res.status(400).json({ error: 'INVALID_SCHEMA_JSON', message: 'Structured data must be valid JSON syntax.' });
      }
    }

    const checkUnsafeScheme = (url?: string | null) => {
      if (!url || typeof url !== 'string') return false;
      const lower = url.trim().toLowerCase();
      return (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:')
      );
    };

    if (canonicalUrl !== undefined && checkUnsafeScheme(canonicalUrl)) {
      return res.status(400).json({ error: 'INVALID_URL_SCHEME', message: 'Dangerous URI schemes are rejected in canonicalUrl.' });
    }
    if (ogImage !== undefined && checkUnsafeScheme(ogImage)) {
      return res.status(400).json({ error: 'INVALID_URL_SCHEME', message: 'Dangerous URI schemes are rejected in ogImage.' });
    }
    if (twitterImage !== undefined && checkUnsafeScheme(twitterImage)) {
      return res.status(400).json({ error: 'INVALID_URL_SCHEME', message: 'Dangerous URI schemes are rejected in twitterImage.' });
    }

    const updated = SeoRepository.upsertPage({
      id: existing.id,
      path: existing.path,
      pageType: pageType !== undefined ? pageType : existing.pageType,
      title: title !== undefined ? title.trim() : existing.title,
      metaTitle: metaTitle !== undefined ? (metaTitle?.trim() || null) : existing.metaTitle,
      metaDescription: metaDescription !== undefined ? (metaDescription?.trim() || null) : existing.metaDescription,
      canonicalUrl: canonicalUrl !== undefined ? (sanitizeUrl(canonicalUrl) || null) : existing.canonicalUrl,
      robotsIndex: robotsIndex !== undefined ? Boolean(robotsIndex) : existing.robotsIndex,
      robotsFollow: robotsFollow !== undefined ? Boolean(robotsFollow) : existing.robotsFollow,
      robotsExtra: robotsExtra !== undefined ? (robotsExtra?.trim() || null) : existing.robotsExtra,
      h1: h1 !== undefined ? (h1?.trim() || null) : existing.h1,
      ogTitle: ogTitle !== undefined ? (ogTitle?.trim() || null) : existing.ogTitle,
      ogDescription: ogDescription !== undefined ? (ogDescription?.trim() || null) : existing.ogDescription,
      ogImage: ogImage !== undefined ? (sanitizeUrl(ogImage) || null) : existing.ogImage,
      ogType: ogType !== undefined ? ogType : existing.ogType,
      twitterCard: twitterCard !== undefined ? twitterCard : existing.twitterCard,
      twitterTitle: twitterTitle !== undefined ? (twitterTitle?.trim() || null) : existing.twitterTitle,
      twitterDescription: twitterDescription !== undefined ? (twitterDescription?.trim() || null) : existing.twitterDescription,
      twitterImage: twitterImage !== undefined ? (sanitizeUrl(twitterImage) || null) : existing.twitterImage,
      schemaType: schemaType !== undefined ? schemaType : existing.schemaType,
      schemaJson: schemaJson !== undefined ? (schemaJson?.trim() || null) : existing.schemaJson,
      sitemapIncluded: sitemapIncluded !== undefined ? Boolean(sitemapIncluded) : existing.sitemapIncluded,
      sitemapPriority: typeof sitemapPriority === 'number' ? Math.max(0, Math.min(1, sitemapPriority)) : existing.sitemapPriority,
      sitemapChangeFrequency: sitemapChangeFrequency !== undefined ? sitemapChangeFrequency : existing.sitemapChangeFrequency,
      breadcrumbsJson: breadcrumbsJson !== undefined ? (typeof breadcrumbsJson === 'string' ? breadcrumbsJson : JSON.stringify(breadcrumbsJson)) : existing.breadcrumbsJson,
      faqJson: faqJson !== undefined ? (typeof faqJson === 'string' ? faqJson : JSON.stringify(faqJson)) : existing.faqJson,
      createdAt: existing.createdAt,
    });

    AuditService.log({
      actorAdminUserId: req.adminUser?.id,
      actorEmail: req.adminUser?.email,
      action: 'SEO_PAGE_UPDATED',
      resourceType: 'seo_page',
      resourceId: updated.id,
      metadata: { path: updated.path, title: updated.title },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ success: true, page: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_UPDATE_SEO_PAGE', message: error.message });
  }
});

// DELETE /api/admin/seo/pages/:id - Delete custom SEO page
adminSeoRouter.delete('/pages/:id', requirePermission('seo.pages.write'), (req: Request, res: Response) => {
  try {
    const existing = SeoRepository.getPageById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'SEO page not found.' });
    }

    if (existing.path === '/') {
      return res.status(400).json({ error: 'CANNOT_DELETE_HOME', message: 'The homepage SEO record cannot be deleted.' });
    }

    SeoRepository.deletePage(existing.id);

    AuditService.log({
      actorAdminUserId: req.adminUser?.id,
      actorEmail: req.adminUser?.email,
      action: 'SEO_PAGE_DELETED',
      resourceType: 'seo_page',
      resourceId: existing.id,
      metadata: { path: existing.path },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ success: true, message: `SEO page "${existing.path}" deleted.` });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_DELETE_SEO_PAGE', message: error.message });
  }
});

/* ==========================================================================
 * 2. SEO REDIRECTS
 * ========================================================================== */

// GET /api/admin/seo/redirects - List all redirects
adminSeoRouter.get('/redirects', requirePermission('seo.redirects.read'), (_req: Request, res: Response) => {
  try {
    const redirects = SeoRepository.listRedirects();
    return res.json({ success: true, redirects });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_LIST_REDIRECTS', message: error.message });
  }
});

// POST /api/admin/seo/redirects - Create redirect
adminSeoRouter.post('/redirects', requirePermission('seo.redirects.write'), (req: Request, res: Response) => {
  try {
    const { sourcePath, destinationPath, statusCode, enabled } = req.body;

    if (!sourcePath || !destinationPath) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Source and destination paths are required.' });
    }

    const normSource = normalizePath(sourcePath);
    const normDest = normalizePath(destinationPath);

    if (normSource === normDest) {
      return res.status(400).json({ error: 'SELF_REDIRECT_LOOP', message: 'Source and destination paths cannot be identical.' });
    }

    const checkUnsafeDestination = (dest: string) => {
      const lower = dest.trim().toLowerCase();
      return (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:')
      );
    };

    if (checkUnsafeDestination(destinationPath)) {
      return res.status(400).json({ error: 'UNSAFE_DESTINATION', message: 'Dangerous URI schemes are rejected.' });
    }

    // Detect loops: check if destinationPath redirects back to sourcePath
    const existingReverse = SeoRepository.getRedirectBySource(normDest);
    if (existingReverse && normalizePath(existingReverse.destinationPath) === normSource) {
      return res.status(400).json({ error: 'REDIRECT_LOOP', message: 'Redirect loop detected between source and destination.' });
    }

    const code = Number(statusCode) || 301;
    if (![301, 302, 307, 308].includes(code)) {
      return res.status(400).json({ error: 'INVALID_STATUS_CODE', message: 'Status code must be 301, 302, 307, or 308.' });
    }

    const redirect = SeoRepository.upsertRedirect({
      id: crypto.randomUUID(),
      sourcePath: normSource,
      destinationPath: normDest,
      statusCode: code as 301 | 302 | 307 | 308,
      enabled: enabled !== false,
    });

    AuditService.log({
      actorAdminUserId: req.adminUser?.id,
      actorEmail: req.adminUser?.email,
      action: 'SEO_REDIRECT_CREATED',
      resourceType: 'seo_redirect',
      resourceId: redirect.id,
      metadata: { sourcePath: normSource, destinationPath: normDest, statusCode: code },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({ success: true, redirect });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_CREATE_REDIRECT', message: error.message });
  }
});

// PATCH /api/admin/seo/redirects/:id - Update redirect
adminSeoRouter.patch('/redirects/:id', requirePermission('seo.redirects.write'), (req: Request, res: Response) => {
  try {
    const existing = SeoRepository.getRedirectById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'REDIRECT_NOT_FOUND', message: 'Redirect not found.' });
    }

    const { destinationPath, statusCode, enabled } = req.body;

    const normDest = destinationPath !== undefined ? normalizePath(destinationPath) : existing.destinationPath;
    if (existing.sourcePath === normDest) {
      return res.status(400).json({ error: 'SELF_REDIRECT_LOOP', message: 'Source and destination paths cannot be identical.' });
    }

    if (destinationPath !== undefined) {
      const lower = String(destinationPath).trim().toLowerCase();
      if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:')
      ) {
        return res.status(400).json({ error: 'UNSAFE_DESTINATION', message: 'Dangerous URI schemes are rejected.' });
      }

      const existingReverse = SeoRepository.getRedirectBySource(normDest);
      if (existingReverse && normalizePath(existingReverse.destinationPath) === existing.sourcePath) {
        return res.status(400).json({ error: 'REDIRECT_LOOP', message: 'Redirect loop detected between source and destination.' });
      }
    }

    const code = statusCode !== undefined ? Number(statusCode) : existing.statusCode;
    if (![301, 302, 307, 308].includes(code)) {
      return res.status(400).json({ error: 'INVALID_STATUS_CODE', message: 'Status code must be 301, 302, 307, or 308.' });
    }

    const updated = SeoRepository.upsertRedirect({
      id: existing.id,
      sourcePath: existing.sourcePath,
      destinationPath: normDest,
      statusCode: code as 301 | 302 | 307 | 308,
      enabled: enabled !== undefined ? Boolean(enabled) : existing.enabled,
    });

    AuditService.log({
      actorAdminUserId: req.adminUser?.id,
      actorEmail: req.adminUser?.email,
      action: 'SEO_REDIRECT_UPDATED',
      resourceType: 'seo_redirect',
      resourceId: updated.id,
      metadata: { sourcePath: updated.sourcePath, destinationPath: updated.destinationPath },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ success: true, redirect: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_UPDATE_REDIRECT', message: error.message });
  }
});

// DELETE /api/admin/seo/redirects/:id - Delete redirect
adminSeoRouter.delete('/redirects/:id', requirePermission('seo.redirects.write'), (req: Request, res: Response) => {
  try {
    const existing = SeoRepository.getRedirectById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'REDIRECT_NOT_FOUND', message: 'Redirect not found.' });
    }

    SeoRepository.deleteRedirect(existing.id);

    AuditService.log({
      actorAdminUserId: req.adminUser?.id,
      actorEmail: req.adminUser?.email,
      action: 'SEO_REDIRECT_DELETED',
      resourceType: 'seo_redirect',
      resourceId: existing.id,
      metadata: { sourcePath: existing.sourcePath },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ success: true, message: `Redirect for "${existing.sourcePath}" deleted.` });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_DELETE_REDIRECT', message: error.message });
  }
});

/* ==========================================================================
 * 3. SEO HEALTH & AUDIT
 * ========================================================================== */

// GET /api/admin/seo/health - Run technical SEO audit
adminSeoRouter.get('/health', requirePermission('seo.health.read'), (_req: Request, res: Response) => {
  try {
    const reports = SeoService.runHealthAudit();
    const passedCount = reports.filter((r) => r.status === 'PASS').length;
    const warningCount = reports.filter((r) => r.status === 'WARNING').length;
    const errorCount = reports.filter((r) => r.status === 'ERROR').length;

    return res.json({
      success: true,
      summary: {
        total: reports.length,
        passed: passedCount,
        warnings: warningCount,
        errors: errorCount,
        overallStatus: errorCount > 0 ? 'ERROR' : warningCount > 0 ? 'WARNING' : 'PASS',
      },
      reports,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_RUN_HEALTH_CHECK', message: error.message });
  }
});

/* ==========================================================================
 * 4. TECHNICAL SEO SETTINGS
 * ========================================================================== */

// GET /api/admin/seo/settings - Get settings
adminSeoRouter.get('/settings', requirePermission('seo.settings.read'), (_req: Request, res: Response) => {
  try {
    const settings = SeoRepository.getSettings();
    return res.json({ success: true, settings });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_GET_SEO_SETTINGS', message: error.message });
  }
});

// PATCH /api/admin/seo/settings - Update settings
adminSeoRouter.patch('/settings', requirePermission('seo.settings.write'), (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Settings object is required.' });
    }

    for (const [key, val] of Object.entries(settings)) {
      if (typeof val === 'string') {
        SeoRepository.upsertSetting(key, val, undefined, req.adminUser?.email || 'admin');
      }
    }

    AuditService.log({
      actorAdminUserId: req.adminUser?.id,
      actorEmail: req.adminUser?.email,
      action: 'SEO_SETTINGS_UPDATED',
      resourceType: 'seo_settings',
      metadata: { keys: Object.keys(settings) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ success: true, settings: SeoRepository.getSettings() });
  } catch (error: any) {
    return res.status(500).json({ error: 'FAILED_UPDATE_SEO_SETTINGS', message: error.message });
  }
});

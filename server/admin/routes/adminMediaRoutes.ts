/**
 * Express Admin Media Library Routes for Phase 8.4
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requirePermission } from '../middleware/adminAuth.js';
import { MediaRepository } from '../models/mediaRepository.js';
import { MediaService } from '../services/mediaService.js';
import { AuditService } from '../services/auditService.js';

export const adminMediaRouter = Router();

// Configure memory storage for multer so we can run strict magic byte validation before disk writes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
    files: 10, // Max 10 files per multi-upload
  },
});

/**
 * GET /api/admin/media
 * Lists media library assets with search, filter, and pagination
 */
adminMediaRouter.get('/', requirePermission('media.read'), (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const mediaType = typeof req.query.mediaType === 'string' ? (req.query.mediaType as any) : undefined;
    const mimeType = typeof req.query.mimeType === 'string' ? req.query.mimeType : undefined;
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;

    const result = MediaRepository.listAssets({
      search,
      mediaType,
      mimeType,
      limit,
      offset,
    });

    return res.json({
      success: true,
      assets: result.assets,
      total: result.total,
      limit,
      offset,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'MEDIA_LIST_ERROR', message: err.message } });
  }
});

/**
 * GET /api/admin/media/:id
 * Fetches single media asset details with usage detection
 */
adminMediaRouter.get('/:id', requirePermission('media.read'), (req: Request, res: Response) => {
  try {
    const asset = MediaRepository.getAssetById(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, error: { code: 'MEDIA_NOT_FOUND', message: 'Media asset not found.' } });
    }

    const usages = MediaRepository.findUsages(asset.id, asset.publicUrl);
    return res.json({
      success: true,
      asset,
      usages,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'MEDIA_FETCH_ERROR', message: err.message } });
  }
});

/**
 * GET /api/admin/media/:id/usages
 * Returns references where this media asset is used
 */
adminMediaRouter.get('/:id/usages', requirePermission('media.read'), (req: Request, res: Response) => {
  try {
    const asset = MediaRepository.getAssetById(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, error: { code: 'MEDIA_NOT_FOUND', message: 'Media asset not found.' } });
    }

    const usages = MediaRepository.findUsages(asset.id, asset.publicUrl);
    return res.json({ success: true, usages });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'MEDIA_USAGE_ERROR', message: err.message } });
  }
});

/**
 * POST /api/admin/media/upload
 * Securely uploads single or multiple files
 */
adminMediaRouter.post(
  '/upload',
  requirePermission('media.write'),
  upload.array('files', 10),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILES_UPLOADED', message: 'Please select at least one file to upload.' },
        });
      }

      const uploadedAssets = [];
      const user = (req as any).adminUser;

      for (const file of files) {
        const asset = await MediaService.processAndSaveUpload({
          buffer: file.buffer,
          originalFilename: file.originalname,
          declaredMime: file.mimetype,
          uploadedBy: user?.id,
          altText: typeof req.body.altText === 'string' ? req.body.altText : undefined,
          caption: typeof req.body.caption === 'string' ? req.body.caption : undefined,
          title: typeof req.body.title === 'string' ? req.body.title : undefined,
        });

        uploadedAssets.push(asset);

        AuditService.log({
          actorAdminUserId: user?.id,
          actorEmail: user?.email,
          action: 'MEDIA_UPLOADED',
          resourceType: 'media_asset',
          resourceId: asset.id,
          metadata: {
            filename: asset.filename,
            originalFilename: asset.originalFilename,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
          },
        });
      }

      return res.status(201).json({
        success: true,
        assets: uploadedAssets,
        count: uploadedAssets.length,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'UPLOAD_FAILED', message: err.message || 'File upload and validation failed.' },
      });
    }
  }
);

/**
 * PUT /api/admin/media/:id
 * Updates asset metadata (alt text, caption, title)
 */
adminMediaRouter.put('/:id', requirePermission('media.write'), (req: Request, res: Response) => {
  try {
    const { altText, caption, title } = req.body;
    const user = (req as any).adminUser;

    const updated = MediaRepository.updateAssetMetadata(req.params.id, {
      altText,
      caption,
      title,
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'MEDIA_NOT_FOUND', message: 'Media asset not found.' } });
    }

    AuditService.log({
      actorAdminUserId: user?.id,
      actorEmail: user?.email,
      action: 'MEDIA_METADATA_UPDATED',
      resourceType: 'media_asset',
      resourceId: updated.id,
      metadata: { altText: updated.altText, caption: updated.caption, title: updated.title },
    });

    return res.json({ success: true, asset: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'MEDIA_UPDATE_ERROR', message: err.message } });
  }
});

/**
 * DELETE /api/admin/media/:id
 * Deletes media asset, checking for active references to prevent broken links
 */
adminMediaRouter.delete('/:id', requirePermission('media.delete'), async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    const user = (req as any).adminUser;

    const result = await MediaService.deleteAsset(req.params.id, force);
    if (!result.success) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'MEDIA_IN_USE',
          message: 'Cannot delete media asset because it is referenced in published articles, pages, or SEO metadata.',
          usages: result.usages,
        },
      });
    }

    AuditService.log({
      actorAdminUserId: user?.id,
      actorEmail: user?.email,
      action: 'MEDIA_DELETED',
      resourceType: 'media_asset',
      resourceId: req.params.id,
      metadata: { forced: force },
    });

    return res.json({ success: true, message: 'Media asset deleted successfully.' });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 500;
    return res.status(status).json({ success: false, error: { code: 'MEDIA_DELETE_ERROR', message: err.message } });
  }
});

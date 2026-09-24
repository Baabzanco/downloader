/**
 * Media Upload & Security Service for Phase 8.4 Media Library
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { MediaRepository } from '../models/mediaRepository.js';
import { MediaAsset, MediaUsageReference } from '../models/mediaTypes.js';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
  safeExt?: string;
  width?: number | null;
  height?: number | null;
}

export class MediaService {
  private static readonly MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
  ]);

  /**
   * Returns directory path where uploaded media assets are securely stored
   */
  public static getUploadDirectory(): string {
    const uploadDir = path.resolve(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    return uploadDir;
  }

  /**
   * Strict signature / magic bytes validation and dimension extraction
   */
  public static validateBuffer(buffer: Buffer, declaredMime: string, originalName: string): FileValidationResult {
    if (!buffer || buffer.length === 0) {
      return { valid: false, error: 'Empty file buffer received.' };
    }

    if (buffer.length > this.MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: `File size exceeds maximum allowed limit of 15MB.` };
    }

    // 1. Magic Bytes Identification
    let detectedMime: string | null = null;
    let safeExt = '.bin';

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      detectedMime = 'image/png';
      safeExt = '.png';
    }
    // JPEG: FF D8 FF
    else if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      detectedMime = 'image/jpeg';
      safeExt = '.jpg';
    }
    // GIF: 47 49 46 38 (GIF8)
    else if (
      buffer.length >= 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    ) {
      detectedMime = 'image/gif';
      safeExt = '.gif';
    }
    // WebP: RIFF ... WEBP
    else if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      detectedMime = 'image/webp';
      safeExt = '.webp';
    }
    // SVG: Text check for XML/<svg> with strict security sanitization check
    else if (
      (declaredMime === 'image/svg+xml' || originalName.toLowerCase().endsWith('.svg')) &&
      buffer.length < 5 * 1024 * 1024 // 5MB cap for SVGs
    ) {
      const content = buffer.toString('utf-8').trim();
      const hasSvgTag = /<svg[\s\S]*?>/i.test(content);
      const isDangerous = /<script|onload=|onerror=|onclick=|onmouseover=|javascript:|data:text\/html/i.test(content);

      if (hasSvgTag && !isDangerous) {
        detectedMime = 'image/svg+xml';
        safeExt = '.svg';
      }
    }

    if (!detectedMime || !this.ALLOWED_MIME_TYPES.has(detectedMime)) {
      return {
        valid: false,
        error: `Unsupported or invalid file format. Only verified PNG, JPEG, WebP, GIF, and safe SVG images are allowed.`,
      };
    }

    // 2. Extract dimensions
    const dimensions = this.extractImageDimensions(buffer, detectedMime);

    return {
      valid: true,
      detectedMime,
      safeExt,
      width: dimensions.width,
      height: dimensions.height,
    };
  }

  /**
   * Pure binary dimension parser for PNG, JPEG, GIF, WebP (no native C++ dependency)
   */
  public static extractImageDimensions(buffer: Buffer, mime: string): { width: number | null; height: number | null } {
    try {
      if (mime === 'image/png' && buffer.length >= 24) {
        // PNG IHDR width at offset 16, height at offset 20 (big-endian 32-bit int)
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }

      if (mime === 'image/gif' && buffer.length >= 10) {
        // GIF width at offset 6, height at offset 8 (little-endian 16-bit int)
        const width = buffer.readUInt16LE(6);
        const height = buffer.readUInt16LE(8);
        return { width, height };
      }

      if (mime === 'image/webp' && buffer.length >= 30) {
        const type = buffer.toString('ascii', 12, 16);
        if (type === 'VP8 ' && buffer.length >= 30) {
          // VP8 lossy
          const width = buffer.readUInt16LE(26) & 0x3fff;
          const height = buffer.readUInt16LE(28) & 0x3fff;
          return { width, height };
        } else if (type === 'VP8L' && buffer.length >= 25) {
          // VP8L lossless
          const b1 = buffer[21];
          const b2 = buffer[22];
          const b3 = buffer[23];
          const b4 = buffer[24];
          const width = 1 + (((b2 & 0x3f) << 8) | b1);
          const height = 1 + ((((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)));
          return { width, height };
        }
      }

      if (mime === 'image/jpeg') {
        let offset = 2;
        while (offset < buffer.length - 8) {
          if (buffer[offset] !== 0xff) {
            offset++;
            continue;
          }
          const marker = buffer[offset + 1];
          // SOF0 (0xC0) to SOF2 (0xC2) contain width/height
          if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          const length = buffer.readUInt16BE(offset + 2);
          offset += 2 + length;
        }
      }
    } catch {
      // ignore dimension parse errors
    }

    return { width: null, height: null };
  }

  /**
   * Processes and stores uploaded file safely
   */
  public static async processAndSaveUpload(params: {
    buffer: Buffer;
    originalFilename: string;
    declaredMime: string;
    uploadedBy?: string;
    altText?: string;
    caption?: string;
    title?: string;
  }): Promise<MediaAsset> {
    const sanitizedOriginal = path.basename(params.originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const validation = this.validateBuffer(params.buffer, params.declaredMime, sanitizedOriginal);

    if (!validation.valid || !validation.detectedMime || !validation.safeExt) {
      throw new Error(validation.error || 'Invalid file payload.');
    }

    const randomId = crypto.randomUUID();
    const storageKey = `${randomId}${validation.safeExt}`;
    const uploadDir = this.getUploadDirectory();
    const diskPath = path.join(uploadDir, storageKey);

    // Save physical file
    await fs.promises.writeFile(diskPath, params.buffer);

    const publicUrl = `/uploads/${storageKey}`;

    return MediaRepository.createAsset({
      filename: storageKey,
      originalFilename: sanitizedOriginal,
      mimeType: validation.detectedMime,
      mediaType: 'image',
      sizeBytes: params.buffer.length,
      width: validation.width,
      height: validation.height,
      storageKey,
      publicUrl,
      altText: params.altText,
      caption: params.caption,
      title: params.title || sanitizedOriginal,
      uploadedBy: params.uploadedBy,
    });
  }

  /**
   * Deletes asset and cleans up physical file from disk
   */
  public static async deleteAsset(assetId: string, force = false): Promise<{ success: boolean; usages?: MediaUsageReference[] }> {
    const asset = MediaRepository.getAssetById(assetId);
    if (!asset) {
      throw new Error('Media asset not found.');
    }

    const usages = MediaRepository.findUsages(asset.id, asset.publicUrl);
    if (usages.length > 0 && !force) {
      return { success: false, usages };
    }

    // Delete physical file
    const uploadDir = this.getUploadDirectory();
    const diskPath = path.join(uploadDir, asset.storageKey);
    try {
      if (fs.existsSync(diskPath)) {
        await fs.promises.unlink(diskPath);
      }
    } catch (err) {
      console.warn(`[MediaService] Warning deleting file: ${diskPath}`, err);
    }

    MediaRepository.deleteAsset(asset.id);
    return { success: true };
  }
}

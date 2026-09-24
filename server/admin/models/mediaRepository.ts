/**
 * SQLite Media Repository for Phase 8.4 Media Library
 */

import { getDatabase } from '../../db/database.js';
import {
  MediaAsset,
  MediaAssetCreateInput,
  MediaAssetUpdateInput,
  MediaListFilter,
  MediaUsageReference,
} from './mediaTypes.js';
import crypto from 'crypto';

export class MediaRepository {
  public static createAsset(input: MediaAssetCreateInput): MediaAsset {
    const db = getDatabase();
    const id = `media_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO media_assets (
        id, filename, original_filename, mime_type, media_type,
        size_bytes, width, height, storage_key, public_url,
        alt_text, caption, title, uploaded_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.filename,
      input.originalFilename,
      input.mimeType,
      input.mediaType || 'image',
      input.sizeBytes,
      input.width ?? null,
      input.height ?? null,
      input.storageKey,
      input.publicUrl,
      input.altText ?? null,
      input.caption ?? null,
      input.title ?? input.originalFilename,
      input.uploadedBy ?? null,
      now,
      now
    );

    return this.getAssetById(id)!;
  }

  public static getAssetById(id: string): MediaAsset | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public static getAssetByStorageKey(storageKey: string): MediaAsset | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM media_assets WHERE storage_key = ?').get(storageKey) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public static listAssets(filter?: MediaListFilter): { assets: MediaAsset[]; total: number } {
    const db = getDatabase();
    const limit = Math.min(filter?.limit ?? 50, 200);
    const offset = filter?.offset ?? 0;

    let query = 'SELECT * FROM media_assets';
    let countQuery = 'SELECT COUNT(*) as count FROM media_assets';
    const params: any[] = [];
    const countParams: any[] = [];
    const conditions: string[] = [];

    if (filter?.search) {
      conditions.push('(filename LIKE ? OR original_filename LIKE ? OR title LIKE ? OR alt_text LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
      countParams.push(term, term, term, term);
    }

    if (filter?.mediaType) {
      conditions.push('media_type = ?');
      params.push(filter.mediaType);
      countParams.push(filter.mediaType);
    }

    if (filter?.mimeType) {
      conditions.push('mime_type LIKE ?');
      params.push(`%${filter.mimeType}%`);
      countParams.push(`%${filter.mimeType}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const countRow = db.prepare(countQuery).get(...countParams) as any;
    const total = Number(countRow?.count || 0);

    const rows = db.prepare(query).all(...params) as any[];
    const assets = rows.map((r) => this.mapRow(r));

    return { assets, total };
  }

  public static updateAssetMetadata(id: string, updates: MediaAssetUpdateInput): MediaAsset | null {
    const db = getDatabase();
    const existing = this.getAssetById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const altText = updates.altText !== undefined ? updates.altText : existing.altText;
    const caption = updates.caption !== undefined ? updates.caption : existing.caption;
    const title = updates.title !== undefined ? updates.title : existing.title;

    db.prepare(`
      UPDATE media_assets SET
        alt_text = ?,
        caption = ?,
        title = ?,
        updated_at = ?
      WHERE id = ?
    `).run(altText, caption, title, now, id);

    return this.getAssetById(id);
  }

  public static deleteAsset(id: string): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM media_assets WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Scans SQLite database to identify all references to a media asset
   * (featured images, content documents, SEO images, and landing sections)
   */
  public static findUsages(assetId: string, publicUrl: string): MediaUsageReference[] {
    const db = getDatabase();
    const references: MediaUsageReference[] = [];

    // 1. Featured media in blog posts
    const featuredRows = db.prepare(`
      SELECT id, title, slug FROM blog_posts WHERE featured_media_id = ?
    `).all(assetId) as any[];
    for (const row of featuredRows) {
      references.push({
        type: 'post_featured',
        id: row.id,
        title: row.title,
        pathOrSlug: `/blog/${row.slug}`,
      });
    }

    // 2. Embedded in blog post content documents
    const contentDocRows = db.prepare(`
      SELECT id, title, slug FROM blog_posts WHERE content_document LIKE ?
    `).all(`%${publicUrl}%`) as any[];
    for (const row of contentDocRows) {
      if (!references.some((r) => r.type === 'post_content' && r.id === row.id)) {
        references.push({
          type: 'post_content',
          id: row.id,
          title: row.title,
          pathOrSlug: `/blog/${row.slug}`,
        });
      }
    }

    // 3. Featured in SEO pages (og_image or twitter_image)
    const seoRows = db.prepare(`
      SELECT id, title, path FROM seo_pages WHERE og_image = ? OR twitter_image = ?
    `).all(publicUrl, publicUrl) as any[];
    for (const row of seoRows) {
      references.push({
        type: 'seo_og',
        id: row.id,
        title: row.title,
        pathOrSlug: row.path,
      });
    }

    // 4. Content page sections (landing page hero/cards)
    const sectionRows = db.prepare(`
      SELECT s.id, p.title, p.path FROM content_page_sections s
      JOIN content_pages p ON s.page_id = p.id
      WHERE s.data_json LIKE ?
    `).all(`%${publicUrl}%`) as any[];
    for (const row of sectionRows) {
      references.push({
        type: 'content_section',
        id: row.id,
        title: row.title,
        pathOrSlug: row.path,
      });
    }

    return references;
  }

  private static mapRow(row: any): MediaAsset {
    return {
      id: row.id,
      filename: row.filename,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      mediaType: row.media_type,
      sizeBytes: Number(row.size_bytes),
      width: row.width !== null ? Number(row.width) : null,
      height: row.height !== null ? Number(row.height) : null,
      storageKey: row.storage_key,
      publicUrl: row.public_url,
      altText: row.alt_text,
      caption: row.caption,
      title: row.title,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * Content Repository for Phase 8.3 Pages / Landing CMS
 */

import { getDatabase } from '../../db/database.js';
import {
  ContentPage,
  ContentPageSection,
  ContentPageWithSections,
  ContentPreviewToken,
  ContentPageStatus,
  ContentPageType,
  SectionType,
} from './contentTypes.js';
import crypto from 'crypto';

interface DbPageRow {
  id: string;
  path: string;
  page_type: string;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface DbSectionRow {
  id: string;
  page_id: string;
  section_type: string;
  sort_order: number;
  data_json: string;
  is_visible: number;
  created_at: string;
  updated_at: string;
}

function mapPageRow(row: DbPageRow): ContentPage {
  return {
    id: row.id,
    path: row.path,
    pageType: row.page_type as ContentPageType,
    title: row.title,
    slug: row.slug,
    status: row.status as ContentPageStatus,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

function mapSectionRow(row: DbSectionRow): ContentPageSection {
  let parsedData: any = {};
  try {
    parsedData = JSON.parse(row.data_json);
  } catch {
    parsedData = {};
  }

  return {
    id: row.id,
    pageId: row.page_id,
    sectionType: row.section_type as SectionType,
    sortOrder: row.sort_order,
    data: parsedData,
    isVisible: Boolean(row.is_visible),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ContentRepository {
  /**
   * List all pages with optional filters
   */
  static listPages(filter?: {
    status?: ContentPageStatus;
    pageType?: ContentPageType;
    search?: string;
  }): ContentPage[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM content_pages WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.pageType) {
      sql += ' AND page_type = ?';
      params.push(filter.pageType);
    }

    if (filter?.search) {
      sql += ' AND (title LIKE ? OR path LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY path ASC';

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as unknown as DbPageRow[];
    return rows.map(mapPageRow);
  }

  /**
   * Get page by ID
   */
  static getPageById(id: string): ContentPage | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM content_pages WHERE id = ?');
    const row = stmt.get(id) as unknown as DbPageRow | undefined;
    return row ? mapPageRow(row) : null;
  }

  /**
   * Get page by normalized path
   */
  static getPageByPath(path: string): ContentPage | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM content_pages WHERE path = ?');
    const row = stmt.get(path) as unknown as DbPageRow | undefined;
    return row ? mapPageRow(row) : null;
  }

  /**
   * Get sections for a page ordered by sort_order
   */
  static getPageSections(pageId: string, onlyVisible = false): ContentPageSection[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM content_page_sections WHERE page_id = ?';
    if (onlyVisible) {
      sql += ' AND is_visible = 1';
    }
    sql += ' ORDER BY sort_order ASC, created_at ASC';

    const stmt = db.prepare(sql);
    const rows = stmt.all(pageId) as unknown as DbSectionRow[];
    return rows.map(mapSectionRow);
  }

  /**
   * Get page with all ordered sections
   */
  static getPageWithSections(id: string, onlyVisible = false): ContentPageWithSections | null {
    const page = this.getPageById(id);
    if (!page) return null;
    const sections = this.getPageSections(id, onlyVisible);
    return { ...page, sections };
  }

  /**
   * Get page with all ordered sections by path
   */
  static getPageWithSectionsByPath(path: string, onlyVisible = false): ContentPageWithSections | null {
    const page = this.getPageByPath(path);
    if (!page) return null;
    const sections = this.getPageSections(page.id, onlyVisible);
    return { ...page, sections };
  }

  /**
   * Create a new page
   */
  static createPage(page: {
    id?: string;
    path: string;
    pageType?: ContentPageType;
    title: string;
    slug?: string;
    status?: ContentPageStatus;
    createdBy?: string | null;
  }): ContentPage {
    const db = getDatabase();
    const id = page.id || `page_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const slug = page.slug || (page.path === '/' ? 'home' : page.path.replace(/^\//, '').replace(/\//g, '-'));
    const status = page.status || 'draft';
    const publishedAt = status === 'published' ? now : null;

    const stmt = db.prepare(`
      INSERT INTO content_pages (
        id, path, page_type, title, slug, status, published_at, created_at, updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      page.path,
      page.pageType || 'TOOL_PAGE',
      page.title,
      slug,
      status,
      publishedAt,
      now,
      now,
      page.createdBy || null,
      page.createdBy || null
    );

    return this.getPageById(id)!;
  }

  /**
   * Update an existing page
   */
  static updatePage(
    id: string,
    updates: Partial<{
      path: string;
      pageType: ContentPageType;
      title: string;
      slug: string;
      status: ContentPageStatus;
      publishedAt: string | null;
      updatedBy: string | null;
    }>
  ): ContentPage {
    const existing = this.getPageById(id);
    if (!existing) {
      throw new Error(`Content page with id "${id}" does not exist.`);
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    const path = updates.path !== undefined ? updates.path : existing.path;
    const pageType = updates.pageType !== undefined ? updates.pageType : existing.pageType;
    const title = updates.title !== undefined ? updates.title : existing.title;
    const slug = updates.slug !== undefined ? updates.slug : existing.slug;
    const status = updates.status !== undefined ? updates.status : existing.status;
    let publishedAt = updates.publishedAt !== undefined ? updates.publishedAt : existing.publishedAt;

    if (status === 'published' && !publishedAt) {
      publishedAt = now;
    } else if (status === 'draft') {
      publishedAt = null;
    }

    const stmt = db.prepare(`
      UPDATE content_pages SET
        path = ?,
        page_type = ?,
        title = ?,
        slug = ?,
        status = ?,
        published_at = ?,
        updated_at = ?,
        updated_by = ?
      WHERE id = ?
    `);

    stmt.run(
      path,
      pageType,
      title,
      slug,
      status,
      publishedAt,
      now,
      updates.updatedBy || existing.updatedBy,
      id
    );

    return this.getPageById(id)!;
  }

  /**
   * Delete page and its associated sections
   */
  static deletePage(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM content_pages WHERE id = ?');
    const result = stmt.run(id);
    return Number(result.changes) > 0;
  }

  /**
   * Publish page
   */
  static publishPage(id: string, updatedBy?: string): ContentPage {
    return this.updatePage(id, {
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedBy,
    });
  }

  /**
   * Unpublish page (moves to draft)
   */
  static unpublishPage(id: string, updatedBy?: string): ContentPage {
    return this.updatePage(id, {
      status: 'draft',
      publishedAt: null,
      updatedBy,
    });
  }

  /**
   * Archive page
   */
  static archivePage(id: string, updatedBy?: string): ContentPage {
    return this.updatePage(id, {
      status: 'archived',
      updatedBy,
    });
  }

  /**
   * Set and replace entire sections list atomically for a page
   */
  static setSections(
    pageId: string,
    sections: Array<{
      id?: string;
      sectionType: SectionType;
      sortOrder?: number;
      data: any;
      isVisible?: boolean;
    }>
  ): ContentPageSection[] {
    const db = getDatabase();
    const now = new Date().toISOString();

    db.exec('BEGIN TRANSACTION');
    try {
      // Delete existing sections
      const delStmt = db.prepare('DELETE FROM content_page_sections WHERE page_id = ?');
      delStmt.run(pageId);

      const insStmt = db.prepare(`
        INSERT INTO content_page_sections (
          id, page_id, section_type, sort_order, data_json, is_visible, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      sections.forEach((sec, idx) => {
        const secId = sec.id || `sec_${crypto.randomUUID()}`;
        const sortOrder = typeof sec.sortOrder === 'number' ? sec.sortOrder : idx;
        const dataJson = typeof sec.data === 'string' ? sec.data : JSON.stringify(sec.data);
        const isVisible = sec.isVisible !== false ? 1 : 0;

        insStmt.run(secId, pageId, sec.sectionType, sortOrder, dataJson, isVisible, now, now);
      });

      // Update parent page updated_at
      const pageUpdate = db.prepare('UPDATE content_pages SET updated_at = ? WHERE id = ?');
      pageUpdate.run(now, pageId);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return this.getPageSections(pageId);
  }

  /**
   * Create cryptographically secure preview token
   */
  static createPreviewToken(pageId: string, userId?: string | null, ttlMinutes = 60): ContentPreviewToken {
    const db = getDatabase();
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
    const createdAt = now.toISOString();

    let validUserId = userId;
    if (userId) {
      const existing = db.prepare('SELECT id FROM admin_users WHERE id = ?').get(userId);
      if (!existing) validUserId = undefined;
    }
    if (!validUserId) {
      const admin = db.prepare('SELECT id FROM admin_users LIMIT 1').get() as { id: string } | undefined;
      validUserId = admin ? admin.id : 'system_admin';
    }

    const stmt = db.prepare(`
      INSERT INTO content_preview_tokens (token, page_id, expires_at, created_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(token, pageId, expiresAt, createdAt, validUserId);

    return {
      token,
      pageId,
      expiresAt,
      createdAt,
      createdBy: validUserId,
    };
  }

  /**
   * Verify preview token
   */
  static verifyPreviewToken(token: string): { valid: boolean; pageId?: string } {
    if (!token || typeof token !== 'string') return { valid: false };

    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM content_preview_tokens WHERE token = ?');
    const row = stmt.get(token) as { token: string; page_id: string; expires_at: string } | undefined;

    if (!row) return { valid: false };

    const expiresAt = new Date(row.expires_at).getTime();
    if (Date.now() > expiresAt) {
      // Expired token
      return { valid: false };
    }

    return { valid: true, pageId: row.page_id };
  }
}

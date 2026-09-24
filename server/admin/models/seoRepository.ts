import { getDatabase } from '../../db/database.js';
import {
  SeoPage,
  SeoRedirect,
  SeoSetting,
  SeoPageType,
  SitemapChangeFreq,
} from './seoTypes.js';

interface RawSeoPageRow {
  id: string;
  path: string;
  page_type: string;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  robots_index: number;
  robots_follow: number;
  robots_extra: string | null;
  h1: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_type: string;
  twitter_card: string;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
  schema_type: string;
  schema_json: string | null;
  sitemap_included: number;
  sitemap_priority: number;
  sitemap_change_frequency: string;
  breadcrumbs_json: string | null;
  faq_json: string | null;
  created_at: string;
  updated_at: string;
}

interface RawSeoRedirectRow {
  id: string;
  source_path: string;
  destination_path: string;
  status_code: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface RawSeoSettingRow {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

function mapPageRow(row: RawSeoPageRow): SeoPage {
  return {
    id: row.id,
    path: row.path,
    pageType: row.page_type as SeoPageType,
    title: row.title,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    canonicalUrl: row.canonical_url,
    robotsIndex: Boolean(row.robots_index),
    robotsFollow: Boolean(row.robots_follow),
    robotsExtra: row.robots_extra,
    h1: row.h1,
    ogTitle: row.og_title,
    ogDescription: row.og_description,
    ogImage: row.og_image,
    ogType: row.og_type || 'website',
    twitterCard: row.twitter_card || 'summary_large_image',
    twitterTitle: row.twitter_title,
    twitterDescription: row.twitter_description,
    twitterImage: row.twitter_image,
    schemaType: row.schema_type || 'WebPage',
    schemaJson: row.schema_json,
    sitemapIncluded: Boolean(row.sitemap_included),
    sitemapPriority: row.sitemap_priority ?? 0.8,
    sitemapChangeFrequency: (row.sitemap_change_frequency || 'weekly') as SitemapChangeFreq,
    breadcrumbsJson: row.breadcrumbs_json,
    faqJson: row.faq_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRedirectRow(row: RawSeoRedirectRow): SeoRedirect {
  return {
    id: row.id,
    sourcePath: row.source_path,
    destinationPath: row.destination_path,
    statusCode: row.status_code as 301 | 302 | 307 | 308,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SeoRepository {
  /* ========================================================================
   * SEO PAGES
   * ======================================================================== */

  static listPages(): SeoPage[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM seo_pages ORDER BY path ASC').all() as unknown as RawSeoPageRow[];
    return rows.map(mapPageRow);
  }

  static getPageById(id: string): SeoPage | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM seo_pages WHERE id = ?').get(id) as unknown as RawSeoPageRow | undefined;
    return row ? mapPageRow(row) : null;
  }

  static getPageByPath(path: string): SeoPage | null {
    const db = getDatabase();
    // Normalize path
    const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
    const row = db.prepare('SELECT * FROM seo_pages WHERE path = ?').get(normalized) as unknown as RawSeoPageRow | undefined;
    return row ? mapPageRow(row) : null;
  }

  static upsertPage(page: Omit<SeoPage, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }): SeoPage {
    const db = getDatabase();
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id, created_at FROM seo_pages WHERE id = ? OR path = ?').get(page.id, page.path) as { id: string; created_at: string } | undefined;

    const createdAt = existing ? existing.created_at : (page.createdAt || now);
    const updatedAt = now;
    const id = existing ? existing.id : page.id;

    const stmt = db.prepare(`
      INSERT INTO seo_pages (
        id, path, page_type, title, meta_title, meta_description, canonical_url,
        robots_index, robots_follow, robots_extra, h1,
        og_title, og_description, og_image, og_type,
        twitter_card, twitter_title, twitter_description, twitter_image,
        schema_type, schema_json,
        sitemap_included, sitemap_priority, sitemap_change_frequency,
        breadcrumbs_json, faq_json, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
      ON CONFLICT(path) DO UPDATE SET
        page_type = excluded.page_type,
        title = excluded.title,
        meta_title = excluded.meta_title,
        meta_description = excluded.meta_description,
        canonical_url = excluded.canonical_url,
        robots_index = excluded.robots_index,
        robots_follow = excluded.robots_follow,
        robots_extra = excluded.robots_extra,
        h1 = excluded.h1,
        og_title = excluded.og_title,
        og_description = excluded.og_description,
        og_image = excluded.og_image,
        og_type = excluded.og_type,
        twitter_card = excluded.twitter_card,
        twitter_title = excluded.twitter_title,
        twitter_description = excluded.twitter_description,
        twitter_image = excluded.twitter_image,
        schema_type = excluded.schema_type,
        schema_json = excluded.schema_json,
        sitemap_included = excluded.sitemap_included,
        sitemap_priority = excluded.sitemap_priority,
        sitemap_change_frequency = excluded.sitemap_change_frequency,
        breadcrumbs_json = excluded.breadcrumbs_json,
        faq_json = excluded.faq_json,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      id,
      page.path,
      page.pageType || 'TOOL_PAGE',
      page.title,
      page.metaTitle ?? null,
      page.metaDescription ?? null,
      page.canonicalUrl ?? null,
      page.robotsIndex ? 1 : 0,
      page.robotsFollow ? 1 : 0,
      page.robotsExtra ?? null,
      page.h1 ?? null,
      page.ogTitle ?? null,
      page.ogDescription ?? null,
      page.ogImage ?? null,
      page.ogType || 'website',
      page.twitterCard || 'summary_large_image',
      page.twitterTitle ?? null,
      page.twitterDescription ?? null,
      page.twitterImage ?? null,
      page.schemaType || 'WebPage',
      page.schemaJson ?? null,
      page.sitemapIncluded ? 1 : 0,
      page.sitemapPriority ?? 0.8,
      page.sitemapChangeFrequency || 'weekly',
      page.breadcrumbsJson ?? null,
      page.faqJson ?? null,
      createdAt,
      updatedAt
    );

    return this.getPageById(id)!;
  }

  static deletePage(id: string): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM seo_pages WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }

  static getSitemapPages(): SeoPage[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM seo_pages 
      WHERE sitemap_included = 1 AND robots_index = 1
      ORDER BY sitemap_priority DESC, path ASC
    `).all() as unknown as RawSeoPageRow[];
    return rows.map(mapPageRow);
  }

  /* ========================================================================
   * SEO REDIRECTS
   * ======================================================================== */

  static listRedirects(): SeoRedirect[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM seo_redirects ORDER BY source_path ASC').all() as unknown as RawSeoRedirectRow[];
    return rows.map(mapRedirectRow);
  }

  static getRedirectById(id: string): SeoRedirect | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM seo_redirects WHERE id = ?').get(id) as unknown as RawSeoRedirectRow | undefined;
    return row ? mapRedirectRow(row) : null;
  }

  static getRedirectBySource(sourcePath: string): SeoRedirect | null {
    const db = getDatabase();
    const normalized = sourcePath.length > 1 && sourcePath.endsWith('/') ? sourcePath.slice(0, -1) : sourcePath;
    const row = db.prepare('SELECT * FROM seo_redirects WHERE source_path = ?').get(normalized) as unknown as RawSeoRedirectRow | undefined;
    return row ? mapRedirectRow(row) : null;
  }

  static upsertRedirect(redirect: Omit<SeoRedirect, 'createdAt' | 'updatedAt'>): SeoRedirect {
    const db = getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO seo_redirects (id, source_path, destination_path, status_code, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_path) DO UPDATE SET
        destination_path = excluded.destination_path,
        status_code = excluded.status_code,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      redirect.id,
      redirect.sourcePath,
      redirect.destinationPath,
      redirect.statusCode || 301,
      redirect.enabled ? 1 : 0,
      now,
      now
    );

    return this.getRedirectById(redirect.id) || this.getRedirectBySource(redirect.sourcePath)!;
  }

  static deleteRedirect(id: string): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM seo_redirects WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }

  /* ========================================================================
   * SEO SETTINGS
   * ======================================================================== */

  static getSettings(): Record<string, SeoSetting> {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM seo_settings').all() as unknown as RawSeoSettingRow[];
    const result: Record<string, SeoSetting> = {};
    for (const r of rows) {
      result[r.key] = {
        key: r.key,
        value: r.value,
        description: r.description,
        updatedAt: r.updated_at,
        updatedBy: r.updated_by,
      };
    }
    return result;
  }

  static getSetting(key: string): string | null {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM seo_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  static upsertSetting(key: string, value: string, description?: string, updatedBy?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO seo_settings (key, value, description, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        description = COALESCE(excluded.description, seo_settings.description),
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `);
    stmt.run(key, value, description || null, now, updatedBy || null);
  }
}

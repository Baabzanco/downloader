import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

let dbInstance: DatabaseSync | null = null;

export function getDatabasePath(): string {
  if (process.env.TEST_DB_PATH) {
    return process.env.TEST_DB_PATH;
  }
  const dbDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.resolve(dbDir, 'admin.db');
}

export function getDatabase(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();
  const db = new DatabaseSync(dbPath);

  // Enable WAL mode and foreign key constraints
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  initSchema(db);
  dbInstance = db;
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}

export function initSchema(db?: DatabaseSync): void {
  const database = db || getDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_user_roles (
      admin_user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (admin_user_id, role_id),
      FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      last_seen_at TEXT NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_admin_user_id TEXT,
      actor_email TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      metadata TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (actor_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      is_secret INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'general',
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS seo_pages (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      page_type TEXT NOT NULL DEFAULT 'TOOL_PAGE' CHECK (page_type IN ('STATIC_PAGE', 'TOOL_PAGE', 'BLOG_POST', 'BLOG_CATEGORY', 'BLOG_TAG')),
      title TEXT NOT NULL,
      meta_title TEXT,
      meta_description TEXT,
      canonical_url TEXT,
      robots_index INTEGER NOT NULL DEFAULT 1,
      robots_follow INTEGER NOT NULL DEFAULT 1,
      robots_extra TEXT,
      h1 TEXT,
      og_title TEXT,
      og_description TEXT,
      og_image TEXT,
      og_type TEXT DEFAULT 'website',
      twitter_card TEXT DEFAULT 'summary_large_image',
      twitter_title TEXT,
      twitter_description TEXT,
      twitter_image TEXT,
      schema_type TEXT DEFAULT 'WebPage',
      schema_json TEXT,
      sitemap_included INTEGER NOT NULL DEFAULT 1,
      sitemap_priority REAL DEFAULT 0.8,
      sitemap_change_frequency TEXT DEFAULT 'weekly' CHECK (sitemap_change_frequency IN ('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never')),
      breadcrumbs_json TEXT,
      faq_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seo_redirects (
      id TEXT PRIMARY KEY,
      source_path TEXT UNIQUE NOT NULL,
      destination_path TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seo_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    /* ==========================================================================
     * Phase 8.3 Pages / Landing CMS Tables
     * ========================================================================== */
    CREATE TABLE IF NOT EXISTS content_pages (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      page_type TEXT NOT NULL DEFAULT 'TOOL_PAGE' CHECK (page_type IN ('STATIC_PAGE', 'TOOL_PAGE', 'LANDING_PAGE')),
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS content_page_sections (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      section_type TEXT NOT NULL CHECK (section_type IN ('hero', 'rich_text', 'feature_grid', 'how_to', 'faq', 'cta', 'related_tools')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      data_json TEXT NOT NULL,
      is_visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (page_id) REFERENCES content_pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content_preview_tokens (
      token TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY (page_id) REFERENCES content_pages(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    /* ==========================================================================
     * Phase 8.4 Media Library & Blog CMS Tables
     * ========================================================================== */
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'audio', 'document')),
      size_bytes INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      storage_key TEXT UNIQUE NOT NULL,
      public_url TEXT NOT NULL,
      alt_text TEXT,
      caption TEXT,
      title TEXT,
      uploaded_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (uploaded_by) REFERENCES admin_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS blog_categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blog_tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content_document TEXT NOT NULL,
      featured_media_id TEXT,
      author_id TEXT,
      primary_category_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
      publish_at TEXT,
      published_at TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      FOREIGN KEY (featured_media_id) REFERENCES media_assets(id) ON DELETE SET NULL,
      FOREIGN KEY (author_id) REFERENCES admin_users(id) ON DELETE SET NULL,
      FOREIGN KEY (primary_category_id) REFERENCES blog_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS blog_post_categories (
      post_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY (post_id, category_id),
      FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blog_post_tags (
      post_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (post_id, tag_id),
      FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blog_revisions (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      excerpt TEXT,
      content_document TEXT NOT NULL,
      featured_media_id TEXT,
      primary_category_id TEXT,
      category_ids_json TEXT,
      tag_ids_json TEXT,
      author_id TEXT,
      status TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      restore_note TEXT,
      FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS blog_preview_tokens (
      token_hash TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(admin_user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_admin_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_pages_path ON seo_pages(path);
    CREATE INDEX IF NOT EXISTS idx_seo_pages_type ON seo_pages(page_type);
    CREATE INDEX IF NOT EXISTS idx_seo_pages_sitemap ON seo_pages(sitemap_included, robots_index);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_redirects_source ON seo_redirects(source_path);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_content_pages_path ON content_pages(path);
    CREATE INDEX IF NOT EXISTS idx_content_pages_status ON content_pages(status);
    CREATE INDEX IF NOT EXISTS idx_content_pages_type ON content_pages(page_type);
    CREATE INDEX IF NOT EXISTS idx_content_sections_page ON content_page_sections(page_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_content_sections_visible ON content_page_sections(page_id, is_visible);
    CREATE INDEX IF NOT EXISTS idx_content_preview_token ON content_preview_tokens(token, expires_at);
    CREATE INDEX IF NOT EXISTS idx_media_assets_storage_key ON media_assets(storage_key);
    CREATE INDEX IF NOT EXISTS idx_media_assets_mime ON media_assets(mime_type);
    CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(media_type);
    CREATE INDEX IF NOT EXISTS idx_media_assets_created ON media_assets(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_categories_slug ON blog_categories(slug);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_tags_slug ON blog_tags(slug);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_publish_at ON blog_posts(publish_at);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(primary_category_id);
    CREATE INDEX IF NOT EXISTS idx_blog_revisions_post ON blog_revisions(post_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_blog_preview_tokens_post ON blog_preview_tokens(post_id, expires_at);
  `);
}

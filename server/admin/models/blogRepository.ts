/**
 * SQLite Database Repository for Blog Posts, Categories, Tags, and Revisions
 */

import { getDatabase } from '../../db/database.js';
import {
  BlogPost,
  BlogPostStatus,
  BlogPostWithRelations,
  BlogCategory,
  BlogTag,
  BlogRevision,
  BlogListFilter,
} from './blogTypes.js';
import { StructuredDocument } from './blogDocumentTypes.js';
import { MediaRepository } from './mediaRepository.js';
import crypto from 'crypto';

export class BlogRepository {
  /* ==========================================================================
   * Categories
   * ========================================================================== */

  public static createCategory(name: string, slug: string, description?: string | null): BlogCategory {
    const db = getDatabase();
    const id = `cat_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO blog_categories (id, name, slug, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), slug.trim().toLowerCase(), description || null, now, now);

    return this.getCategoryById(id)!;
  }

  public static getCategoryById(id: string): BlogCategory | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM blog_categories WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static getCategoryBySlug(slug: string): BlogCategory | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM blog_categories WHERE slug = ?').get(slug.toLowerCase()) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static listCategories(): BlogCategory[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT c.*, COUNT(pc.post_id) as post_count
      FROM blog_categories c
      LEFT JOIN blog_post_categories pc ON c.id = pc.category_id
      LEFT JOIN blog_posts p ON pc.post_id = p.id AND p.status = 'published'
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      postCount: Number(r.post_count || 0),
    }));
  }

  public static updateCategory(id: string, updates: { name?: string; slug?: string; description?: string | null }): BlogCategory | null {
    const db = getDatabase();
    const existing = this.getCategoryById(id);
    if (!existing) return null;

    const name = updates.name !== undefined ? updates.name.trim() : existing.name;
    const slug = updates.slug !== undefined ? updates.slug.trim().toLowerCase() : existing.slug;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE blog_categories SET
        name = ?,
        slug = ?,
        description = ?,
        updated_at = ?
      WHERE id = ?
    `).run(name, slug, description, now, id);

    return this.getCategoryById(id);
  }

  public static deleteCategory(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare('DELETE FROM blog_categories WHERE id = ?').run(id);
    return res.changes > 0;
  }

  /* ==========================================================================
   * Tags
   * ========================================================================== */

  public static createTag(name: string, slug: string): BlogTag {
    const db = getDatabase();
    const id = `tag_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO blog_tags (id, name, slug, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name.trim(), slug.trim().toLowerCase(), now, now);

    return this.getTagById(id)!;
  }

  public static getTagById(id: string): BlogTag | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM blog_tags WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static getTagBySlug(slug: string): BlogTag | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM blog_tags WHERE slug = ?').get(slug.toLowerCase()) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public static listTags(): BlogTag[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT t.*, COUNT(pt.post_id) as post_count
      FROM blog_tags t
      LEFT JOIN blog_post_tags pt ON t.id = pt.tag_id
      LEFT JOIN blog_posts p ON pt.post_id = p.id AND p.status = 'published'
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      postCount: Number(r.post_count || 0),
    }));
  }

  public static updateTag(id: string, updates: { name?: string; slug?: string }): BlogTag | null {
    const db = getDatabase();
    const existing = this.getTagById(id);
    if (!existing) return null;

    const name = updates.name !== undefined ? updates.name.trim() : existing.name;
    const slug = updates.slug !== undefined ? updates.slug.trim().toLowerCase() : existing.slug;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE blog_tags SET name = ?, slug = ?, updated_at = ? WHERE id = ?
    `).run(name, slug, now, id);

    return this.getTagById(id);
  }

  public static deleteTag(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare('DELETE FROM blog_tags WHERE id = ?').run(id);
    return res.changes > 0;
  }

  /* ==========================================================================
   * Posts
   * ========================================================================== */

  public static createPost(post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    contentDocument: StructuredDocument;
    featuredMediaId?: string | null;
    authorId?: string | null;
    primaryCategoryId?: string | null;
    status: BlogPostStatus;
    publishAt?: string | null;
    publishedAt?: string | null;
    createdBy?: string | null;
    categoryIds?: string[];
    tagIds?: string[];
  }): BlogPostWithRelations {
    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO blog_posts (
        id, title, slug, excerpt, content_document,
        featured_media_id, author_id, primary_category_id,
        status, publish_at, published_at, archived_at,
        created_at, updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      post.id,
      post.title,
      post.slug,
      post.excerpt || null,
      JSON.stringify(post.contentDocument),
      post.featuredMediaId || null,
      post.authorId || null,
      post.primaryCategoryId || null,
      post.status,
      post.publishAt || null,
      post.publishedAt || (post.status === 'published' ? now : null),
      post.status === 'archived' ? now : null,
      now,
      now,
      post.createdBy || null,
      post.createdBy || null
    );

    if (post.categoryIds && post.categoryIds.length > 0) {
      this.setPostCategories(post.id, post.categoryIds);
    }
    if (post.tagIds && post.tagIds.length > 0) {
      this.setPostTags(post.id, post.tagIds);
    }

    return this.getPostWithRelations(post.id)!;
  }

  public static getPostById(id: string): BlogPost | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapPostRow(row);
  }

  public static getPostBySlug(slug: string): BlogPost | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(slug.toLowerCase()) as any;
    if (!row) return null;
    return this.mapPostRow(row);
  }

  public static getPostWithRelations(idOrSlug: string): BlogPostWithRelations | null {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT p.*, u.name as author_name
      FROM blog_posts p
      LEFT JOIN admin_users u ON p.author_id = u.id
      WHERE p.id = ? OR p.slug = ?
    `).get(idOrSlug, idOrSlug.toLowerCase()) as any;

    if (!row) return null;
    const basePost = this.mapPostRow(row);

    // Categories
    const catRows = db.prepare(`
      SELECT c.* FROM blog_categories c
      JOIN blog_post_categories pc ON c.id = pc.category_id
      WHERE pc.post_id = ?
      ORDER BY c.name ASC
    `).all(basePost.id) as any[];
    const categories: BlogCategory[] = catRows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    // Primary category
    const primaryCategory = basePost.primaryCategoryId
      ? categories.find((c) => c.id === basePost.primaryCategoryId) || this.getCategoryById(basePost.primaryCategoryId)
      : null;

    // Tags
    const tagRows = db.prepare(`
      SELECT t.* FROM blog_tags t
      JOIN blog_post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = ?
      ORDER BY t.name ASC
    `).all(basePost.id) as any[];
    const tags: BlogTag[] = tagRows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    // Featured media
    const featuredMedia = basePost.featuredMediaId ? MediaRepository.getAssetById(basePost.featuredMediaId) : null;

    // Estimated read time (assuming ~200 wpm)
    const rawText = JSON.stringify(basePost.contentDocument);
    const words = rawText.split(/\s+/).length;
    const readTimeMinutes = Math.max(1, Math.round(words / 200));

    return {
      ...basePost,
      featuredMedia,
      authorName: row.author_name || null,
      primaryCategory,
      categories,
      tags,
      readTimeMinutes,
    };
  }

  public static listPosts(filter?: BlogListFilter): { posts: BlogPostWithRelations[]; total: number } {
    const db = getDatabase();
    const limit = Math.min(filter?.limit ?? 50, 100);
    const offset = filter?.offset ?? 0;

    let whereParts: string[] = [];
    const params: any[] = [];
    const countParams: any[] = [];

    if (filter?.status && filter.status !== 'all') {
      whereParts.push('p.status = ?');
      params.push(filter.status);
      countParams.push(filter.status);
    }

    if (filter?.categoryId) {
      whereParts.push('(p.primary_category_id = ? OR EXISTS (SELECT 1 FROM blog_post_categories pc WHERE pc.post_id = p.id AND pc.category_id = ?))');
      params.push(filter.categoryId, filter.categoryId);
      countParams.push(filter.categoryId, filter.categoryId);
    }

    if (filter?.categorySlug) {
      whereParts.push(`EXISTS (
        SELECT 1 FROM blog_post_categories pc
        JOIN blog_categories c ON pc.category_id = c.id
        WHERE pc.post_id = p.id AND c.slug = ?
      )`);
      params.push(filter.categorySlug.toLowerCase());
      countParams.push(filter.categorySlug.toLowerCase());
    }

    if (filter?.tagId) {
      whereParts.push('EXISTS (SELECT 1 FROM blog_post_tags pt WHERE pt.post_id = p.id AND pt.tag_id = ?)');
      params.push(filter.tagId);
      countParams.push(filter.tagId);
    }

    if (filter?.tagSlug) {
      whereParts.push(`EXISTS (
        SELECT 1 FROM blog_post_tags pt
        JOIN blog_tags t ON pt.tag_id = t.id
        WHERE pt.post_id = p.id AND t.slug = ?
      )`);
      params.push(filter.tagSlug.toLowerCase());
      countParams.push(filter.tagSlug.toLowerCase());
    }

    if (filter?.authorId) {
      whereParts.push('p.author_id = ?');
      params.push(filter.authorId);
      countParams.push(filter.authorId);
    }

    if (filter?.search) {
      whereParts.push('(p.title LIKE ? OR p.excerpt LIKE ?)');
      const term = `%${filter.search}%`;
      params.push(term, term);
      countParams.push(term, term);
    }

    const whereClause = whereParts.length > 0 ? ' WHERE ' + whereParts.join(' AND ') : '';

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM blog_posts p ${whereClause}`).get(...countParams) as any;
    const total = Number(countRow?.count || 0);

    const query = `
      SELECT p.*, u.name as author_name
      FROM blog_posts p
      LEFT JOIN admin_users u ON p.author_id = u.id
      ${whereClause}
      ORDER BY 
        CASE WHEN p.published_at IS NOT NULL THEN p.published_at ELSE p.created_at END DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params) as any[];
    const posts = rows.map((r) => this.getPostWithRelations(r.id)!);

    return { posts, total };
  }

  public static updatePost(id: string, updates: Partial<{
    title: string;
    slug: string;
    excerpt: string | null;
    contentDocument: StructuredDocument;
    featuredMediaId: string | null;
    authorId: string | null;
    primaryCategoryId: string | null;
    status: BlogPostStatus;
    publishAt: string | null;
    publishedAt: string | null;
    archivedAt: string | null;
    updatedBy: string | null;
  }>): BlogPostWithRelations | null {
    const db = getDatabase();
    const existing = this.getPostById(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    const title = updates.title !== undefined ? updates.title : existing.title;
    const slug = updates.slug !== undefined ? updates.slug.toLowerCase() : existing.slug;
    const excerpt = updates.excerpt !== undefined ? updates.excerpt : existing.excerpt;
    const contentDocument = updates.contentDocument !== undefined ? updates.contentDocument : existing.contentDocument;
    const featuredMediaId = updates.featuredMediaId !== undefined ? updates.featuredMediaId : existing.featuredMediaId;
    const authorId = updates.authorId !== undefined ? updates.authorId : existing.authorId;
    const primaryCategoryId = updates.primaryCategoryId !== undefined ? updates.primaryCategoryId : existing.primaryCategoryId;
    const status = updates.status !== undefined ? updates.status : existing.status;
    const publishAt = updates.publishAt !== undefined ? updates.publishAt : existing.publishAt;
    let publishedAt = updates.publishedAt !== undefined ? updates.publishedAt : existing.publishedAt;
    let archivedAt = updates.archivedAt !== undefined ? updates.archivedAt : existing.archivedAt;

    if (status === 'published' && !publishedAt) {
      publishedAt = now;
    }
    if (status === 'archived' && !archivedAt) {
      archivedAt = now;
    }

    db.prepare(`
      UPDATE blog_posts SET
        title = ?,
        slug = ?,
        excerpt = ?,
        content_document = ?,
        featured_media_id = ?,
        author_id = ?,
        primary_category_id = ?,
        status = ?,
        publish_at = ?,
        published_at = ?,
        archived_at = ?,
        updated_at = ?,
        updated_by = ?
      WHERE id = ?
    `).run(
      title,
      slug,
      excerpt,
      JSON.stringify(contentDocument),
      featuredMediaId,
      authorId,
      primaryCategoryId,
      status,
      publishAt,
      publishedAt,
      archivedAt,
      now,
      updates.updatedBy || null,
      id
    );

    return this.getPostWithRelations(id);
  }

  public static setPostCategories(postId: string, categoryIds: string[]): void {
    const db = getDatabase();
    db.prepare('DELETE FROM blog_post_categories WHERE post_id = ?').run(postId);
    const insert = db.prepare('INSERT OR IGNORE INTO blog_post_categories (post_id, category_id) VALUES (?, ?)');
    for (const catId of categoryIds) {
      insert.run(postId, catId);
    }
  }

  public static setPostTags(postId: string, tagIds: string[]): void {
    const db = getDatabase();
    db.prepare('DELETE FROM blog_post_tags WHERE post_id = ?').run(postId);
    const insert = db.prepare('INSERT OR IGNORE INTO blog_post_tags (post_id, tag_id) VALUES (?, ?)');
    for (const tagId of tagIds) {
      insert.run(postId, tagId);
    }
  }

  public static deletePost(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare('DELETE FROM blog_posts WHERE id = ?').run(id);
    return res.changes > 0;
  }

  /**
   * Retrieves scheduled posts whose target publish_at has passed
   */
  public static getScheduledPostsReadyForPublish(nowIso: string): BlogPost[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM blog_posts
      WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= ?
    `).all(nowIso) as any[];

    return rows.map((r) => this.mapPostRow(r));
  }

  /* ==========================================================================
   * Revisions
   * ========================================================================== */

  public static createRevision(params: {
    postId: string;
    title: string;
    slug: string;
    excerpt: string | null;
    contentDocument: StructuredDocument;
    featuredMediaId?: string | null;
    primaryCategoryId?: string | null;
    categoryIds?: string[];
    tagIds?: string[];
    authorId?: string | null;
    status: BlogPostStatus;
    createdBy?: string | null;
    restoreNote?: string | null;
  }): BlogRevision {
    const db = getDatabase();
    const id = `rev_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO blog_revisions (
        id, post_id, title, slug, excerpt, content_document,
        featured_media_id, primary_category_id, category_ids_json, tag_ids_json,
        author_id, status, created_by, created_at, restore_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.postId,
      params.title,
      params.slug,
      params.excerpt || null,
      JSON.stringify(params.contentDocument),
      params.featuredMediaId || null,
      params.primaryCategoryId || null,
      JSON.stringify(params.categoryIds || []),
      JSON.stringify(params.tagIds || []),
      params.authorId || null,
      params.status,
      params.createdBy || null,
      now,
      params.restoreNote || null
    );

    return this.getRevisionById(id)!;
  }

  public static getRevisionsByPostId(postId: string): BlogRevision[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT r.*, u.name as created_by_name
      FROM blog_revisions r
      LEFT JOIN admin_users u ON r.created_by = u.id
      WHERE r.post_id = ?
      ORDER BY r.created_at DESC
    `).all(postId) as any[];

    return rows.map((r) => ({
      id: r.id,
      postId: r.post_id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      contentDocument: JSON.parse(r.content_document),
      featuredMediaId: r.featured_media_id,
      primaryCategoryId: r.primary_category_id,
      categoryIds: JSON.parse(r.category_ids_json || '[]'),
      tagIds: JSON.parse(r.tag_ids_json || '[]'),
      authorId: r.author_id,
      status: r.status,
      createdBy: r.created_by,
      createdByName: r.created_by_name || null,
      createdAt: r.created_at,
      restoreNote: r.restore_note,
    }));
  }

  public static getRevisionById(id: string): BlogRevision | null {
    const db = getDatabase();
    const r = db.prepare(`
      SELECT r.*, u.name as created_by_name
      FROM blog_revisions r
      LEFT JOIN admin_users u ON r.created_by = u.id
      WHERE r.id = ?
    `).get(id) as any;

    if (!r) return null;
    return {
      id: r.id,
      postId: r.post_id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      contentDocument: JSON.parse(r.content_document),
      featuredMediaId: r.featured_media_id,
      primaryCategoryId: r.primary_category_id,
      categoryIds: JSON.parse(r.category_ids_json || '[]'),
      tagIds: JSON.parse(r.tag_ids_json || '[]'),
      authorId: r.author_id,
      status: r.status,
      createdBy: r.created_by,
      createdByName: r.created_by_name || null,
      createdAt: r.created_at,
      restoreNote: r.restore_note,
    };
  }

  /* ==========================================================================
   * Preview Tokens
   * ========================================================================== */

  public static createPreviewToken(postId: string, userId: string, ttlMinutes = 60): string {
    const db = getDatabase();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO blog_preview_tokens (token_hash, post_id, expires_at, created_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(tokenHash, postId, expiresAt, now.toISOString(), userId);

    return rawToken;
  }

  public static verifyPreviewToken(rawToken: string, postId: string): boolean {
    const db = getDatabase();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const nowIso = new Date().toISOString();

    const row = db.prepare(`
      SELECT * FROM blog_preview_tokens
      WHERE token_hash = ? AND post_id = ? AND expires_at > ?
    `).get(tokenHash, postId, nowIso) as any;

    return Boolean(row);
  }

  public static cleanupExpiredTokens(): void {
    const db = getDatabase();
    const nowIso = new Date().toISOString();
    db.prepare('DELETE FROM blog_preview_tokens WHERE expires_at <= ?').run(nowIso);
  }

  private static mapPostRow(row: any): BlogPost {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      contentDocument: JSON.parse(row.content_document),
      featuredMediaId: row.featured_media_id,
      authorId: row.author_id,
      primaryCategoryId: row.primary_category_id,
      status: row.status,
      publishAt: row.publish_at,
      publishedAt: row.published_at,
      archivedAt: row.archived_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }
}

/**
 * Blog Management & Business Logic Service for Phase 8.4 Blog CMS
 */

import { BlogRepository } from '../models/blogRepository.js';
import {
  BlogPost,
  BlogPostCreateInput,
  BlogPostUpdateInput,
  BlogPostWithRelations,
  BlogRevision,
  BlogPostStatus,
  BlogCategory,
  BlogTag,
  BlogListFilter,
} from '../models/blogTypes.js';
import { StructuredDocument } from '../models/blogDocumentTypes.js';
import { SeoRepository } from '../models/seoRepository.js';
import { AuditService } from './auditService.js';
import { BlogRendererService } from './blogRendererService.js';
import crypto from 'crypto';

export interface PublicBlogResolution {
  found: boolean;
  isPublished?: boolean;
  isPreview?: boolean;
  status?: BlogPostStatus;
  post?: BlogPostWithRelations;
  renderedContentHtml?: string;
}

export class BlogService {
  private static schedulerInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes background scheduler worker for scheduled posts
   */
  public static startScheduler(intervalMs = 15000): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    this.schedulerInterval = setInterval(() => {
      this.checkAndPublishScheduledPosts().catch((err) => {
        console.error('[BlogService] Scheduler check error:', err);
      });
    }, intervalMs);

    // Initial check immediately
    this.checkAndPublishScheduledPosts().catch(() => {});
  }

  public static stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Evaluates and automatically promotes scheduled posts whose publish_at timestamp has arrived
   */
  public static async checkAndPublishScheduledPosts(): Promise<number> {
    const nowIso = new Date().toISOString();
    const readyPosts = BlogRepository.getScheduledPostsReadyForPublish(nowIso);

    for (const post of readyPosts) {
      const updated = BlogRepository.updatePost(post.id, {
        status: 'published',
        publishedAt: nowIso,
        publishAt: null,
      });

      if (updated) {
        // Sync SEO page
        this.syncPostSeo(updated);

        // Record revision
        BlogRepository.createRevision({
          postId: updated.id,
          title: updated.title,
          slug: updated.slug,
          excerpt: updated.excerpt,
          contentDocument: updated.contentDocument,
          featuredMediaId: updated.featuredMediaId,
          primaryCategoryId: updated.primaryCategoryId,
          categoryIds: updated.categories.map((c) => c.id),
          tagIds: updated.tags.map((t) => t.id),
          authorId: updated.authorId,
          status: 'published',
          createdBy: 'system_scheduler',
          restoreNote: 'Automatically published by server scheduler at scheduled time.',
        });

        // Audit log
        AuditService.log({
          actorAdminUserId: null,
          actorEmail: 'system.scheduler@internal',
          action: 'BLOG_POST_AUTO_PUBLISHED',
          resourceType: 'blog_post',
          resourceId: updated.id,
          metadata: {
            title: updated.title,
            slug: updated.slug,
            publishAt: post.publishAt,
            publishedAt: nowIso,
          },
        });
      }
    }

    return readyPosts.length;
  }

  /**
   * Creates a new blog post with automatic slug generation, initial revision, and SEO sync
   */
  public static createPost(input: BlogPostCreateInput, userId?: string, userEmail?: string): BlogPostWithRelations {
    const title = (input.title || '').trim();
    if (!title) {
      throw new Error('Article title is required.');
    }

    let slug = this.normalizeSlug(input.slug || title);
    if (!slug) {
      slug = `article-${Date.now()}`;
    }

    // Ensure unique slug
    slug = this.ensureUniqueSlug(slug);

    const postId = `post_${crypto.randomUUID()}`;
    const status = input.status || 'draft';
    const nowIso = new Date().toISOString();

    const post = BlogRepository.createPost({
      id: postId,
      title,
      slug,
      excerpt: input.excerpt ? input.excerpt.trim() : null,
      contentDocument: input.contentDocument || { version: 1, type: 'doc', children: [] },
      featuredMediaId: input.featuredMediaId || null,
      authorId: input.authorId || userId || null,
      primaryCategoryId: input.primaryCategoryId || null,
      categoryIds: input.categoryIds || [],
      tagIds: input.tagIds || [],
      status,
      publishAt: input.publishAt || null,
      publishedAt: status === 'published' ? nowIso : null,
      createdBy: userId || null,
    });

    // Create initial revision
    BlogRepository.createRevision({
      postId: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      contentDocument: post.contentDocument,
      featuredMediaId: post.featuredMediaId,
      primaryCategoryId: post.primaryCategoryId,
      categoryIds: post.categories.map((c) => c.id),
      tagIds: post.tags.map((t) => t.id),
      authorId: post.authorId,
      status: post.status,
      createdBy: userId || null,
      restoreNote: 'Initial article creation.',
    });

    // Sync SEO page
    this.syncPostSeo(post, input.seoTitle, input.metaDescription);

    AuditService.log({
      actorAdminUserId: userId || null,
      actorEmail: userEmail || null,
      action: 'BLOG_POST_CREATED',
      resourceType: 'blog_post',
      resourceId: post.id,
      metadata: { title: post.title, slug: post.slug, status: post.status },
    });

    return post;
  }

  /**
   * Updates an existing blog post, creates revision snapshot, handles slug redirects & SEO sync
   */
  public static updatePost(id: string, input: BlogPostUpdateInput, userId?: string, userEmail?: string): BlogPostWithRelations {
    const existing = BlogRepository.getPostWithRelations(id);
    if (!existing) {
      throw new Error('Blog article not found.');
    }

    let slug = existing.slug;
    if (input.slug && input.slug.trim() !== '') {
      const candidateSlug = this.normalizeSlug(input.slug);
      if (candidateSlug !== existing.slug) {
        slug = this.ensureUniqueSlug(candidateSlug, existing.id);

        // If previously published, register 301 redirect from old slug to new slug
        if (existing.publishedAt) {
          SeoRepository.upsertRedirect({
            id: `redir_${crypto.randomUUID()}`,
            sourcePath: `/blog/${existing.slug}`,
            destinationPath: `/blog/${slug}`,
            statusCode: 301,
            enabled: true,
          });
        }
      }
    }

    const updated = BlogRepository.updatePost(id, {
      title: input.title !== undefined ? input.title.trim() : undefined,
      slug,
      excerpt: input.excerpt !== undefined ? (input.excerpt ? input.excerpt.trim() : null) : undefined,
      contentDocument: input.contentDocument !== undefined ? input.contentDocument : undefined,
      featuredMediaId: input.featuredMediaId !== undefined ? input.featuredMediaId : undefined,
      authorId: input.authorId !== undefined ? input.authorId : undefined,
      primaryCategoryId: input.primaryCategoryId !== undefined ? input.primaryCategoryId : undefined,
      status: input.status !== undefined ? input.status : undefined,
      publishAt: input.publishAt !== undefined ? input.publishAt : undefined,
      updatedBy: userId || null,
    });

    if (!updated) {
      throw new Error('Failed to update blog article.');
    }

    if (input.categoryIds !== undefined) {
      BlogRepository.setPostCategories(id, input.categoryIds);
    }
    if (input.tagIds !== undefined) {
      BlogRepository.setPostTags(id, input.tagIds);
    }

    const finalPost = BlogRepository.getPostWithRelations(id)!;

    // Create revision snapshot
    BlogRepository.createRevision({
      postId: finalPost.id,
      title: finalPost.title,
      slug: finalPost.slug,
      excerpt: finalPost.excerpt,
      contentDocument: finalPost.contentDocument,
      featuredMediaId: finalPost.featuredMediaId,
      primaryCategoryId: finalPost.primaryCategoryId,
      categoryIds: finalPost.categories.map((c) => c.id),
      tagIds: finalPost.tags.map((t) => t.id),
      authorId: finalPost.authorId,
      status: finalPost.status,
      createdBy: userId || null,
      restoreNote: 'Article updated via editor.',
    });

    // Sync SEO
    this.syncPostSeo(finalPost, input.seoTitle, input.metaDescription);

    AuditService.log({
      actorAdminUserId: userId || null,
      actorEmail: userEmail || null,
      action: 'BLOG_POST_UPDATED',
      resourceType: 'blog_post',
      resourceId: finalPost.id,
      metadata: { title: finalPost.title, slug: finalPost.slug, status: finalPost.status },
    });

    return finalPost;
  }

  /**
   * Publishes an article immediately
   */
  public static publishPost(id: string, userId?: string, userEmail?: string): BlogPostWithRelations {
    const post = BlogRepository.getPostWithRelations(id);
    if (!post) throw new Error('Blog article not found.');

    const nowIso = new Date().toISOString();
    const updated = BlogRepository.updatePost(id, {
      status: 'published',
      publishedAt: post.publishedAt || nowIso,
      publishAt: null,
      updatedBy: userId,
    });

    if (!updated) throw new Error('Failed to publish article.');

    this.syncPostSeo(updated);

    BlogRepository.createRevision({
      postId: updated.id,
      title: updated.title,
      slug: updated.slug,
      excerpt: updated.excerpt,
      contentDocument: updated.contentDocument,
      featuredMediaId: updated.featuredMediaId,
      primaryCategoryId: updated.primaryCategoryId,
      categoryIds: updated.categories.map((c) => c.id),
      tagIds: updated.tags.map((t) => t.id),
      authorId: updated.authorId,
      status: 'published',
      createdBy: userId || null,
      restoreNote: 'Article published.',
    });

    AuditService.log({
      actorAdminUserId: userId || null,
      actorEmail: userEmail || null,
      action: 'BLOG_POST_PUBLISHED',
      resourceType: 'blog_post',
      resourceId: updated.id,
      metadata: { title: updated.title, slug: updated.slug },
    });

    return updated;
  }

  /**
   * Schedules an article for future publication
   */
  public static schedulePost(id: string, publishAtIso: string, userId?: string, userEmail?: string): BlogPostWithRelations {
    const post = BlogRepository.getPostWithRelations(id);
    if (!post) throw new Error('Blog article not found.');

    const targetDate = new Date(publishAtIso);
    if (isNaN(targetDate.getTime()) || targetDate.getTime() <= Date.now()) {
      throw new Error('Schedule publish date must be a valid future ISO timestamp.');
    }

    const updated = BlogRepository.updatePost(id, {
      status: 'scheduled',
      publishAt: publishAtIso,
      updatedBy: userId,
    });

    if (!updated) throw new Error('Failed to schedule article.');

    this.syncPostSeo(updated);

    BlogRepository.createRevision({
      postId: updated.id,
      title: updated.title,
      slug: updated.slug,
      excerpt: updated.excerpt,
      contentDocument: updated.contentDocument,
      featuredMediaId: updated.featuredMediaId,
      primaryCategoryId: updated.primaryCategoryId,
      categoryIds: updated.categories.map((c) => c.id),
      tagIds: updated.tags.map((t) => t.id),
      authorId: updated.authorId,
      status: 'scheduled',
      createdBy: userId || null,
      restoreNote: `Article scheduled for publication at ${publishAtIso}.`,
    });

    AuditService.log({
      actorAdminUserId: userId || null,
      actorEmail: userEmail || null,
      action: 'BLOG_POST_SCHEDULED',
      resourceType: 'blog_post',
      resourceId: updated.id,
      metadata: { title: updated.title, slug: updated.slug, publishAt: publishAtIso },
    });

    return updated;
  }

  /**
   * Unpublishes an article (reverts to draft)
   */
  public static unpublishPost(id: string, userId?: string, userEmail?: string): BlogPostWithRelations {
    const post = BlogRepository.getPostWithRelations(id);
    if (!post) throw new Error('Blog article not found.');

    const updated = BlogRepository.updatePost(id, {
      status: 'draft',
      updatedBy: userId,
    });

    if (!updated) throw new Error('Failed to unpublish article.');

    this.syncPostSeo(updated);

    BlogRepository.createRevision({
      postId: updated.id,
      title: updated.title,
      slug: updated.slug,
      excerpt: updated.excerpt,
      contentDocument: updated.contentDocument,
      featuredMediaId: updated.featuredMediaId,
      primaryCategoryId: updated.primaryCategoryId,
      categoryIds: updated.categories.map((c) => c.id),
      tagIds: updated.tags.map((t) => t.id),
      authorId: updated.authorId,
      status: 'draft',
      createdBy: userId || null,
      restoreNote: 'Article unpublished (moved to draft).',
    });

    AuditService.log({
      actorAdminUserId: userId || null,
      actorEmail: userEmail || null,
      action: 'BLOG_POST_UNPUBLISHED',
      resourceType: 'blog_post',
      resourceId: updated.id,
      metadata: { title: updated.title, slug: updated.slug },
    });

    return updated;
  }

  /**
   * Archives an article
   */
  public static archivePost(id: string, userId?: string, userEmail?: string): BlogPostWithRelations {
    const post = BlogRepository.getPostWithRelations(id);
    if (!post) throw new Error('Blog article not found.');

    const nowIso = new Date().toISOString();
    const updated = BlogRepository.updatePost(id, {
      status: 'archived',
      archivedAt: nowIso,
      updatedBy: userId,
    });

    if (!updated) throw new Error('Failed to archive article.');

    this.syncPostSeo(updated);

    BlogRepository.createRevision({
      postId: updated.id,
      title: updated.title,
      slug: updated.slug,
      excerpt: updated.excerpt,
      contentDocument: updated.contentDocument,
      featuredMediaId: updated.featuredMediaId,
      primaryCategoryId: updated.primaryCategoryId,
      categoryIds: updated.categories.map((c) => c.id),
      tagIds: updated.tags.map((t) => t.id),
      authorId: updated.authorId,
      status: 'archived',
      createdBy: userId || null,
      restoreNote: 'Article archived.',
    });

    AuditService.log({
      actorAdminUserId: userId || null,
      actorEmail: userEmail || null,
      action: 'BLOG_POST_ARCHIVED',
      resourceType: 'blog_post',
      resourceId: updated.id,
      metadata: { title: updated.title, slug: updated.slug },
    });

    return updated;
  }

  /**
   * Restores an article revision safely (preventing IDOR, creating a new revision entry)
   */
  public static restoreRevision(postId: string, revisionId: string, userId?: string, userEmail?: string): BlogPostWithRelations {
    const post = BlogRepository.getPostWithRelations(postId);
    if (!post) throw new Error('Blog article not found.');

    const revision = BlogRepository.getRevisionById(revisionId);
    if (!revision) throw new Error('Revision record not found.');

    // IDOR protection: ensure revision belongs strictly to this post
    if (revision.postId !== post.id) {
      throw new Error('IDOR violation: Revision does not belong to the requested post.');
    }

    // Apply revision snapshot to current post
    const restored = BlogRepository.updatePost(post.id, {
      title: revision.title,
      slug: revision.slug,
      excerpt: revision.excerpt,
      contentDocument: revision.contentDocument,
      featuredMediaId: revision.featuredMediaId,
      primaryCategoryId: revision.primaryCategoryId,
      updatedBy: userId,
    });

    if (!restored) throw new Error('Failed to restore article revision.');

    if (revision.categoryIds) {
      BlogRepository.setPostCategories(post.id, revision.categoryIds);
    }
    if (revision.tagIds) {
      BlogRepository.setPostTags(post.id, revision.tagIds);
    }

    const finalPost = BlogRepository.getPostWithRelations(post.id)!;

    // Create a brand new revision snapshot marking the restoration
    BlogRepository.createRevision({
      postId: finalPost.id,
      title: finalPost.title,
      slug: finalPost.slug,
      excerpt: finalPost.excerpt,
      contentDocument: finalPost.contentDocument,
      featuredMediaId: finalPost.featuredMediaId,
      primaryCategoryId: finalPost.primaryCategoryId,
      categoryIds: finalPost.categories.map((c) => c.id),
      tagIds: finalPost.tags.map((t) => t.id),
      authorId: finalPost.authorId,
      status: finalPost.status,
      createdBy: userId || null,
      restoreNote: `Restored snapshot from revision ${revision.id} (created at ${revision.createdAt}).`,
    });

    this.syncPostSeo(finalPost);

    AuditService.log({
      actorAdminUserId: userId || null,
      actorEmail: userEmail || null,
      action: 'BLOG_REVISION_RESTORED',
      resourceType: 'blog_post',
      resourceId: finalPost.id,
      metadata: { restoredRevisionId: revision.id, title: finalPost.title },
    });

    return finalPost;
  }

  /**
   * Generates secure cryptographic preview token for unpublished drafts
   */
  public static createPreviewToken(postId: string, userId: string, ttlMinutes = 60): string {
    const post = BlogRepository.getPostById(postId);
    if (!post) throw new Error('Blog article not found.');
    return BlogRepository.createPreviewToken(post.id, userId, ttlMinutes);
  }

  /**
   * Resolves public blog article by slug, enforcing draft isolation and preview security
   */
  public static resolvePublicPost(slug: string, previewToken?: string): PublicBlogResolution {
    const post = BlogRepository.getPostWithRelations(slug);
    if (!post) {
      return { found: false };
    }

    const isPublished = post.status === 'published';

    if (isPublished) {
      const renderedHtml = BlogRendererService.renderDocumentToHtml(post.contentDocument);
      return {
        found: true,
        isPublished: true,
        isPreview: false,
        status: post.status,
        post,
        renderedContentHtml: renderedHtml,
      };
    }

    // Draft / Scheduled / Archived isolation
    if (previewToken) {
      const isValid = BlogRepository.verifyPreviewToken(previewToken, post.id);
      if (isValid) {
        const renderedHtml = BlogRendererService.renderDocumentToHtml(post.contentDocument);
        return {
          found: true,
          isPublished: false,
          isPreview: true,
          status: post.status,
          post,
          renderedContentHtml: renderedHtml,
        };
      }
    }

    return {
      found: true,
      isPublished: false,
      isPreview: false,
      status: post.status,
    };
  }

  /**
   * Injects rendered article SSR HTML, OpenGraph, JSON-LD Schema into template
   */
  public static injectBlogPostIntoHtml(html: string, post: BlogPostWithRelations, isPreview = false): string {
    const renderedBody = BlogRendererService.renderDocumentToHtml(post.contentDocument);

    const previewBanner = isPreview
      ? `<div style="background-color: #f59e0b; color: #1c1917; padding: 12px 16px; text-align: center; font-weight: 700; font-size: 14px; position: sticky; top: 0; z-index: 99999; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">PREVIEW MODE — Unsaved / Draft Article (${post.status.toUpperCase()})</div>`
      : '';

    const featuredImgHtml = post.featuredMedia
      ? `<div class="cms-blog-featured-media mb-8 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800"><img src="${post.featuredMedia.publicUrl}" alt="${BlogRendererService.escapeHtml(post.featuredMedia.altText || post.title)}" class="w-full h-auto max-h-[480px] object-cover" /></div>`
      : '';

    const categoriesHtml = post.categories.length > 0
      ? `<div class="flex flex-wrap gap-2 mb-4">${post.categories.map((c) => `<a href="/blog/category/${c.slug}" class="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">${BlogRendererService.escapeHtml(c.name)}</a>`).join('')}</div>`
      : '';

    const dateStr = post.publishedAt
      ? new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : new Date(post.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const serverRenderedArticle = `
      ${previewBanner}
      <div id="cms-blog-server-content" class="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
        <article class="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 md:p-14 shadow-xl border border-slate-200/80 dark:border-slate-800">
          <header class="mb-8 border-b border-slate-200 dark:border-slate-800 pb-8">
            ${categoriesHtml}
            <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-4">${BlogRendererService.escapeHtml(post.title)}</h1>
            ${post.excerpt ? `<p class="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed italic mb-6">${BlogRendererService.escapeHtml(post.excerpt)}</p>` : ''}
            <div class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>By <strong class="text-slate-700 dark:text-slate-200">${BlogRendererService.escapeHtml(post.authorName || 'Editorial Team')}</strong></span>
              <span>•</span>
              <time datetime="${post.publishedAt || post.createdAt}">${dateStr}</time>
              <span>•</span>
              <span>${post.readTimeMinutes || 3} min read</span>
            </div>
          </header>
          ${featuredImgHtml}
          <div class="cms-article-prose prose prose-lg dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
            ${renderedBody}
          </div>
          ${post.tags.length > 0 ? `
          <footer class="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium text-slate-500 dark:text-slate-400">Tags:</span>
              ${post.tags.map((t) => `<a href="/blog/tag/${t.slug}" class="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors">#${BlogRendererService.escapeHtml(t.name)}</a>`).join('')}
            </div>
          </footer>
          ` : ''}
        </article>
      </div>
    `;

    // Inject into root element
    if (html.includes('<div id="root"></div>')) {
      return html.replace('<div id="root"></div>', `<div id="root">${serverRenderedArticle}</div>`);
    }

    return html;
  }

  /**
   * Synchronizes blog post metadata to SEO repository
   */
  private static syncPostSeo(post: BlogPostWithRelations, customSeoTitle?: string, customMetaDesc?: string): void {
    const postPath = `/blog/${post.slug}`;
    const existingSeo = SeoRepository.getPageByPath(postPath);

    const isPublished = post.status === 'published';
    const title = customSeoTitle || existingSeo?.metaTitle || `${post.title} — Video Downloader Blog`;
    const description = customMetaDesc || existingSeo?.metaDescription || post.excerpt || `Read ${post.title} on our official video downloader blog.`;
    const ogImage = post.featuredMedia?.publicUrl || existingSeo?.ogImage || null;

    const schemaJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description,
      image: ogImage ? [ogImage] : undefined,
      datePublished: post.publishedAt || post.createdAt,
      dateModified: post.updatedAt,
      author: {
        '@type': 'Person',
        name: post.authorName || 'Editorial Team',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Video Downloader Pro',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': postPath,
      },
    });

    const seoId = existingSeo ? existingSeo.id : `seo_blog_${post.id}`;

    SeoRepository.upsertPage({
      id: seoId,
      path: postPath,
      pageType: 'BLOG_POST',
      title,
      metaTitle: title,
      metaDescription: description,
      canonicalUrl: null,
      robotsIndex: isPublished,
      robotsFollow: true,
      robotsExtra: null,
      h1: title,
      ogTitle: title,
      ogDescription: description,
      ogImage: ogImage || null,
      ogType: 'article',
      twitterCard: 'summary_large_image',
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: ogImage || null,
      schemaType: 'BlogPosting',
      schemaJson,
      sitemapIncluded: isPublished,
      sitemapPriority: 0.7,
      sitemapChangeFrequency: 'weekly',
      breadcrumbsJson: null,
      faqJson: null,
    });
  }

  private static normalizeSlug(slug: string): string {
    return slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private static ensureUniqueSlug(baseSlug: string, currentPostId?: string): string {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = BlogRepository.getPostBySlug(slug);
      if (!existing || (currentPostId && existing.id === currentPostId)) {
        return slug;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }
}

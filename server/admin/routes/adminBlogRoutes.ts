/**
 * Express Admin Blog CMS Routes for Phase 8.4
 */

import { Router, Request, Response } from 'express';
import { requirePermission } from '../middleware/adminAuth.js';
import { BlogRepository } from '../models/blogRepository.js';
import { BlogService } from '../services/blogService.js';
import { AuditService } from '../services/auditService.js';

export const adminBlogRouter = Router();

/* ==========================================================================
 * Blog Posts CRUD & Publishing Endpoints
 * ========================================================================== */

/**
 * GET /api/admin/blog/posts
 */
adminBlogRouter.get('/posts', requirePermission('blog.posts.read'), (req: Request, res: Response) => {
  try {
    const status = (req.query.status as any) || 'all';
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
    const tagId = typeof req.query.tagId === 'string' ? req.query.tagId : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;

    const result = BlogRepository.listPosts({
      status,
      categoryId,
      tagId,
      search,
      limit,
      offset,
    });

    return res.json({
      success: true,
      posts: result.posts,
      total: result.total,
      limit,
      offset,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'BLOG_LIST_ERROR', message: err.message } });
  }
});

/**
 * POST /api/admin/blog/posts
 */
adminBlogRouter.post('/posts', requirePermission('blog.posts.write'), (req: Request, res: Response) => {
  try {
    const {
      title,
      slug,
      excerpt,
      contentDocument,
      featuredMediaId,
      primaryCategoryId,
      categoryIds,
      tagIds,
      status,
      publishAt,
      seoTitle,
      metaDescription,
    } = req.body;

    const user = (req as any).adminUser;

    const post = BlogService.createPost(
      {
        title,
        slug,
        excerpt,
        contentDocument,
        featuredMediaId,
        primaryCategoryId,
        categoryIds,
        tagIds,
        status,
        publishAt,
        seoTitle,
        metaDescription,
      },
      user?.id,
      user?.email
    );

    return res.status(201).json({ success: true, post });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: 'BLOG_CREATE_ERROR', message: err.message } });
  }
});

/**
 * GET /api/admin/blog/posts/:id
 */
adminBlogRouter.get('/posts/:id', requirePermission('blog.posts.read'), (req: Request, res: Response) => {
  try {
    const post = BlogRepository.getPostWithRelations(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: { code: 'POST_NOT_FOUND', message: 'Blog article not found.' } });
    }
    return res.json({ success: true, post });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'BLOG_FETCH_ERROR', message: err.message } });
  }
});

/**
 * PUT /api/admin/blog/posts/:id
 */
adminBlogRouter.put('/posts/:id', requirePermission('blog.posts.write'), (req: Request, res: Response) => {
  try {
    const {
      title,
      slug,
      excerpt,
      contentDocument,
      featuredMediaId,
      authorId,
      primaryCategoryId,
      categoryIds,
      tagIds,
      status,
      publishAt,
      seoTitle,
      metaDescription,
    } = req.body;

    const user = (req as any).adminUser;

    // Reject attempt to modify protected internal fields through mass assignment
    const post = BlogService.updatePost(
      req.params.id,
      {
        title,
        slug,
        excerpt,
        contentDocument,
        featuredMediaId,
        authorId,
        primaryCategoryId,
        categoryIds,
        tagIds,
        status,
        publishAt,
        seoTitle,
        metaDescription,
      },
      user?.id,
      user?.email
    );

    return res.json({ success: true, post });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, error: { code: 'BLOG_UPDATE_ERROR', message: err.message } });
  }
});

/**
 * DELETE /api/admin/blog/posts/:id
 */
adminBlogRouter.delete('/posts/:id', requirePermission('blog.posts.delete'), (req: Request, res: Response) => {
  try {
    const post = BlogRepository.getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: { code: 'POST_NOT_FOUND', message: 'Blog article not found.' } });
    }

    const user = (req as any).adminUser;
    BlogRepository.deletePost(post.id);

    AuditService.log({
      actorAdminUserId: user?.id,
      actorEmail: user?.email,
      action: 'BLOG_POST_DELETED',
      resourceType: 'blog_post',
      resourceId: post.id,
      metadata: { title: post.title, slug: post.slug },
    });

    return res.json({ success: true, message: 'Article deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'BLOG_DELETE_ERROR', message: err.message } });
  }
});

/**
 * POST /api/admin/blog/posts/:id/publish
 */
adminBlogRouter.post('/posts/:id/publish', requirePermission('blog.posts.publish'), (req: Request, res: Response) => {
  try {
    const user = (req as any).adminUser;
    const post = BlogService.publishPost(req.params.id, user?.id, user?.email);
    return res.json({ success: true, post });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, error: { code: 'PUBLISH_ERROR', message: err.message } });
  }
});

/**
 * POST /api/admin/blog/posts/:id/schedule
 */
adminBlogRouter.post('/posts/:id/schedule', requirePermission('blog.posts.publish'), (req: Request, res: Response) => {
  try {
    const { publishAt } = req.body;
    if (!publishAt) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TIMESTAMP', message: 'publishAt ISO timestamp is required.' },
      });
    }

    const user = (req as any).adminUser;
    const post = BlogService.schedulePost(req.params.id, publishAt, user?.id, user?.email);
    return res.json({ success: true, post });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, error: { code: 'SCHEDULE_ERROR', message: err.message } });
  }
});

/**
 * POST /api/admin/blog/posts/:id/unpublish
 */
adminBlogRouter.post('/posts/:id/unpublish', requirePermission('blog.posts.publish'), (req: Request, res: Response) => {
  try {
    const user = (req as any).adminUser;
    const post = BlogService.unpublishPost(req.params.id, user?.id, user?.email);
    return res.json({ success: true, post });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, error: { code: 'UNPUBLISH_ERROR', message: err.message } });
  }
});

/**
 * POST /api/admin/blog/posts/:id/archive
 */
adminBlogRouter.post('/posts/:id/archive', requirePermission('blog.posts.publish'), (req: Request, res: Response) => {
  try {
    const user = (req as any).adminUser;
    const post = BlogService.archivePost(req.params.id, user?.id, user?.email);
    return res.json({ success: true, post });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, error: { code: 'ARCHIVE_ERROR', message: err.message } });
  }
});

/**
 * POST /api/admin/blog/posts/:id/preview-token
 */
adminBlogRouter.post('/posts/:id/preview-token', requirePermission('blog.posts.read'), (req: Request, res: Response) => {
  try {
    const user = (req as any).adminUser;
    const token = BlogService.createPreviewToken(req.params.id, user?.id || 'admin_user', 60);
    const post = BlogRepository.getPostById(req.params.id);

    return res.json({
      success: true,
      token,
      previewUrl: `/blog/${post?.slug}?previewToken=${token}`,
      expiresInMinutes: 60,
    });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, error: { code: 'PREVIEW_TOKEN_ERROR', message: err.message } });
  }
});

/* ==========================================================================
 * Revisions Endpoints
 * ========================================================================== */

/**
 * GET /api/admin/blog/posts/:id/revisions
 */
adminBlogRouter.get('/posts/:id/revisions', requirePermission('blog.posts.read'), (req: Request, res: Response) => {
  try {
    const post = BlogRepository.getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: { code: 'POST_NOT_FOUND', message: 'Blog article not found.' } });
    }

    const revisions = BlogRepository.getRevisionsByPostId(post.id);
    return res.json({ success: true, revisions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'REVISIONS_FETCH_ERROR', message: err.message } });
  }
});

/**
 * GET /api/admin/blog/posts/:id/revisions/:revisionId
 */
adminBlogRouter.get('/posts/:id/revisions/:revisionId', requirePermission('blog.posts.read'), (req: Request, res: Response) => {
  try {
    const revision = BlogRepository.getRevisionById(req.params.revisionId);
    if (!revision || revision.postId !== req.params.id) {
      return res.status(404).json({ success: false, error: { code: 'REVISION_NOT_FOUND', message: 'Revision record not found.' } });
    }
    return res.json({ success: true, revision });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'REVISION_FETCH_ERROR', message: err.message } });
  }
});

/**
 * POST /api/admin/blog/posts/:id/revisions/:revisionId/restore
 */
adminBlogRouter.post('/posts/:id/revisions/:revisionId/restore', requirePermission('blog.revisions.restore'), (req: Request, res: Response) => {
  try {
    const user = (req as any).adminUser;
    const post = BlogService.restoreRevision(req.params.id, req.params.revisionId, user?.id, user?.email);
    return res.json({ success: true, post, message: 'Revision restored successfully.' });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ success: false, error: { code: 'REVISION_RESTORE_ERROR', message: err.message } });
  }
});

/* ==========================================================================
 * Taxonomy Endpoints (Categories & Tags)
 * ========================================================================== */

// Categories
adminBlogRouter.get('/categories', requirePermission('blog.posts.read'), (_req: Request, res: Response) => {
  try {
    const categories = BlogRepository.listCategories();
    return res.json({ success: true, categories });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'CATEGORIES_ERROR', message: err.message } });
  }
});

adminBlogRouter.post('/categories', requirePermission('blog.taxonomy.manage'), (req: Request, res: Response) => {
  try {
    const { name, slug, description } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Category name is required.' } });
    }
    const safeSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const category = BlogRepository.createCategory(name, safeSlug, description);

    const user = (req as any).adminUser;
    AuditService.log({
      actorAdminUserId: user?.id,
      actorEmail: user?.email,
      action: 'BLOG_CATEGORY_CREATED',
      resourceType: 'blog_category',
      resourceId: category.id,
      metadata: { name: category.name, slug: category.slug },
    });

    return res.status(201).json({ success: true, category });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: 'CATEGORY_CREATE_ERROR', message: err.message } });
  }
});

adminBlogRouter.put('/categories/:id', requirePermission('blog.taxonomy.manage'), (req: Request, res: Response) => {
  try {
    const { name, slug, description } = req.body;
    const updated = BlogRepository.updateCategory(req.params.id, { name, slug, description });
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' } });
    }

    const user = (req as any).adminUser;
    AuditService.log({
      actorAdminUserId: user?.id,
      actorEmail: user?.email,
      action: 'BLOG_CATEGORY_UPDATED',
      resourceType: 'blog_category',
      resourceId: updated.id,
      metadata: { name: updated.name, slug: updated.slug },
    });

    return res.json({ success: true, category: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: 'CATEGORY_UPDATE_ERROR', message: err.message } });
  }
});

adminBlogRouter.delete('/categories/:id', requirePermission('blog.taxonomy.manage'), (req: Request, res: Response) => {
  try {
    const cat = BlogRepository.getCategoryById(req.params.id);
    if (!cat) {
      return res.status(404).json({ success: false, error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' } });
    }

    BlogRepository.deleteCategory(cat.id);

    const user = (req as any).adminUser;
    AuditService.log({
      actorAdminUserId: user?.id,
      actorEmail: user?.email,
      action: 'BLOG_CATEGORY_DELETED',
      resourceType: 'blog_category',
      resourceId: cat.id,
      metadata: { name: cat.name, slug: cat.slug },
    });

    return res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'CATEGORY_DELETE_ERROR', message: err.message } });
  }
});

// Tags
adminBlogRouter.get('/tags', requirePermission('blog.posts.read'), (_req: Request, res: Response) => {
  try {
    const tags = BlogRepository.listTags();
    return res.json({ success: true, tags });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'TAGS_ERROR', message: err.message } });
  }
});

adminBlogRouter.post('/tags', requirePermission('blog.taxonomy.manage'), (req: Request, res: Response) => {
  try {
    const { name, slug } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Tag name is required.' } });
    }
    const safeSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const tag = BlogRepository.createTag(name, safeSlug);

    const user = (req as any).adminUser;
    AuditService.log({
      actorAdminUserId: user?.id,
      actorEmail: user?.email,
      action: 'BLOG_TAG_CREATED',
      resourceType: 'blog_tag',
      resourceId: tag.id,
      metadata: { name: tag.name, slug: tag.slug },
    });

    return res.status(201).json({ success: true, tag });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: 'TAG_CREATE_ERROR', message: err.message } });
  }
});

adminBlogRouter.put('/tags/:id', requirePermission('blog.taxonomy.manage'), (req: Request, res: Response) => {
  try {
    const { name, slug } = req.body;
    const updated = BlogRepository.updateTag(req.params.id, { name, slug });
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'TAG_NOT_FOUND', message: 'Tag not found.' } });
    }

    const user = (req as any).adminUser;
    AuditService.log({
      actorAdminUserId: user?.id,
      actorEmail: user?.email,
      action: 'BLOG_TAG_UPDATED',
      resourceType: 'blog_tag',
      resourceId: updated.id,
      metadata: { name: updated.name, slug: updated.slug },
    });

    return res.json({ success: true, tag: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: 'TAG_UPDATE_ERROR', message: err.message } });
  }
});

adminBlogRouter.delete('/tags/:id', requirePermission('blog.taxonomy.manage'), (req: Request, res: Response) => {
  try {
    const tag = BlogRepository.getTagById(req.params.id);
    if (!tag) {
      return res.status(404).json({ success: false, error: { code: 'TAG_NOT_FOUND', message: 'Tag not found.' } });
    }

    BlogRepository.deleteTag(tag.id);

    const user = (req as any).adminUser;
    AuditService.log({
      actorAdminUserId: user?.id,
      actorEmail: user?.email,
      action: 'BLOG_TAG_DELETED',
      resourceType: 'blog_tag',
      resourceId: tag.id,
      metadata: { name: tag.name, slug: tag.slug },
    });

    return res.json({ success: true, message: 'Tag deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'TAG_DELETE_ERROR', message: err.message } });
  }
});

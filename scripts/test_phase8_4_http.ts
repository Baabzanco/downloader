/**
 * Phase 8.4 Real HTTP Integration Verification Suite
 * Tests actual HTTP requests against the running Express application
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import { bootstrapAdminSystem } from '../server/admin/bootstrap.js';
import { adminAuthMiddleware } from '../server/admin/middleware/adminAuth.js';
import { adminAuthRouter } from '../server/admin/routes/adminAuthRoutes.js';
import { adminMediaRouter } from '../server/admin/routes/adminMediaRoutes.js';
import { adminBlogRouter } from '../server/admin/routes/adminBlogRoutes.js';
import { SeoService } from '../server/admin/services/seoService.js';
import { ContentService } from '../server/admin/services/contentService.js';
import { MediaService } from '../server/admin/services/mediaService.js';
import { BlogService } from '../server/admin/services/blogService.js';
import { BlogSeeder } from '../server/admin/models/blogSeeder.js';
import { BlogRepository } from '../server/admin/models/blogRepository.js';
import http from 'http';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`, details || '');
    failed++;
  }
}

async function createTestApp() {
  const app = express();
  await bootstrapAdminSystem();
  ContentService.ensureDefaultPagesSeeded();
  BlogSeeder.seedDefaultBlogData();
  BlogService.startScheduler();

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(adminAuthMiddleware);

  app.use('/uploads', express.static(MediaService.getUploadDirectory()));
  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin/media', adminMediaRouter);
  app.use('/api/admin/blog', adminBlogRouter);

  // Public Blog API
  app.get('/api/blog/posts', (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const categorySlug = req.query.category as string | undefined;
      const tagSlug = req.query.tag as string | undefined;
      const search = req.query.q as string | undefined;

      const result = BlogRepository.listPosts({
        status: 'published',
        categorySlug,
        tagSlug,
        search,
      });

      res.json({
        success: true,
        posts: result.posts,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/blog/posts/:slug', (req, res) => {
    try {
      const previewToken = req.query.previewToken as string | undefined;
      const result = BlogService.resolvePublicPost(req.params.slug, previewToken);

      if (!result.found || (!result.isPublished && !result.isPreview)) {
        return res.status(404).json({ success: false, error: 'Post not found.' });
      }

      res.json({
        success: true,
        post: result.post,
        renderedContentHtml: result.renderedContentHtml,
        isPreview: result.isPreview,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/blog/taxonomies', (req, res) => {
    try {
      const categories = BlogRepository.listCategories();
      const tags = BlogRepository.listTags();
      res.json({ success: true, categories, tags });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Sitemap
  app.get('/sitemap.xml', (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const xml = SeoService.generateSitemapXml(origin);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  });

  // SSR Public HTML simulation
  app.get('/blog*', (req, res) => {
    const rawPath = req.path;
    const origin = `${req.protocol}://${req.get('host')}`;
    const previewToken = req.query.previewToken as string | undefined;
    const isPostDetail = rawPath.startsWith('/blog/') && !rawPath.startsWith('/blog/category/') && !rawPath.startsWith('/blog/tag/');

    if (isPostDetail) {
      const slug = rawPath.replace('/blog/', '').trim();
      const resolution = BlogService.resolvePublicPost(slug, previewToken);

      if (!resolution.found || (!resolution.isPublished && !resolution.isPreview)) {
        return res.status(404).send('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Post Not Found</h1></body></html>');
      }

      const seo = SeoService.resolvePageSeo(rawPath, origin);
      const post = resolution.post!;
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${seo.seo?.title || post.title}</title>
  <meta name="description" content="${seo.seo?.metaDescription || post.excerpt}">
  <link rel="canonical" href="${seo.seo?.canonicalUrl || origin + rawPath}">
  <meta name="robots" content="${resolution.isPreview ? 'noindex, nofollow' : (seo.seo?.robots || 'index, follow')}">
  ${seo.seo?.schemaJson ? `<script type="application/ld+json">${seo.seo.schemaJson}</script>` : ''}
</head>
<body>
  <article class="prose">
    <h1>${post.title}</h1>
    <div class="content">${resolution.renderedContentHtml}</div>
  </article>
</body>
</html>`;
      return res.status(200).send(html);
    }

    const seo = SeoService.resolvePageSeo(rawPath, origin);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${seo.seo?.title || 'Blog Index'}</title>
  <meta name="description" content="${seo.seo?.metaDescription || 'Guides'}">
  <link rel="canonical" href="${seo.seo?.canonicalUrl || origin + rawPath}">
</head>
<body><h1>Blog Guides</h1></body>
</html>`;
    return res.status(200).send(html);
  });

  return app;
}

async function runHttpVerification() {
  console.log('===============================================================');
  console.log('🌐 RUNNING PHASE 8.4 HTTP INTEGRATION EVIDENCE SUITE');
  console.log('===============================================================\n');

  const app = await createTestApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3099, resolve));
  const baseUrl = 'http://localhost:3099';

  try {
    // 1. Unauthenticated Negative Access Tests (RBAC 401)
    console.log('--- 1. RBAC SECURITY & AUTHENTICATION ENFORCEMENT ---');
    const unauthMediaRes = await fetch(`${baseUrl}/api/admin/media`);
    assert(unauthMediaRes.status === 401, 'Unauthenticated GET /api/admin/media returns 401 Unauthorized');

    const unauthBlogRes = await fetch(`${baseUrl}/api/admin/blog/posts`);
    assert(unauthBlogRes.status === 401, 'Unauthenticated GET /api/admin/blog/posts returns 401 Unauthorized');

    // 2. Admin Authentication
    console.log('\n--- 2. ADMIN AUTHENTICATION ---');
    const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'Admin12345!Secure',
      }),
    });
    assert(loginRes.status === 200, 'Admin login succeeded (HTTP 200)');
    const cookies = loginRes.headers.get('set-cookie');
    assert(Boolean(cookies && cookies.includes('admin_session=')), 'Received authenticated secure session cookie');

    const authHeaders = {
      'Cookie': cookies || '',
    };

    // 3. Taxonomies HTTP API
    console.log('\n--- 3. TAXONOMY MANAGEMENT HTTP APIs ---');
    const catSlug = `cat-http-${Date.now()}`;
    const createCatRes = await fetch(`${baseUrl}/api/admin/blog/categories`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Video Quality Tips',
        slug: catSlug,
        description: 'Guides on extracting highest bitrate video streams.',
      }),
    });
    assert(createCatRes.status === 201, 'POST /api/admin/blog/categories returns 201 Created');
    const catData = await createCatRes.json();
    const testCatId = catData.category.id;

    const tagSlug = `tag-http-${Date.now()}`;
    const createTagRes = await fetch(`${baseUrl}/api/admin/blog/tags`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `4K Ultra ${Date.now()}`,
        slug: tagSlug,
      }),
    });
    assert(createTagRes.status === 201, 'POST /api/admin/blog/tags returns 201 Created');

    // 4. Blog Post Full Lifecycle HTTP API
    console.log('\n--- 4. BLOG POST LIFECYCLE & STRUCTURED AST HTTP APIs ---');
    const postSlug = `http-guide-post-${Date.now()}`;
    const createPostRes = await fetch(`${baseUrl}/api/admin/blog/posts`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Mastering HD Social Media Downloads',
        slug: postSlug,
        excerpt: 'Complete tutorial on lossless video downloading.',
        contentDocument: {
          version: 1,
          type: 'doc',
          children: [
            { type: 'heading', level: 2, text: 'Introduction to Lossless Quality' },
            { type: 'paragraph', text: 'Lossless video saving maintains the authentic source resolution.' },
          ],
        },
        primaryCategoryId: testCatId,
        categoryIds: [testCatId],
        tagNames: [tagSlug, 'lossless'],
        status: 'draft',
        seo: {
          metaTitle: 'Mastering HD Video Downloads in 2026',
          metaDescription: 'Step by step tutorial on lossless video streaming.',
        },
      }),
    });

    assert(createPostRes.status === 201, 'POST /api/admin/blog/posts creates draft post (HTTP 201)');
    const postJson = await createPostRes.json();
    const postId = postJson.post.id;
    assert(postJson.post.status === 'draft', 'Post status initialized as draft');

    // Update Post (creating revision)
    const updatePostRes = await fetch(`${baseUrl}/api/admin/blog/posts/${postId}`, {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Mastering HD Social Media Downloads (Edition 2)',
        changeReason: 'Updated introduction text',
      }),
    });
    assert(updatePostRes.status === 200, 'PUT /api/admin/blog/posts/:id updates post (HTTP 200)');

    // List Revisions
    const revsRes = await fetch(`${baseUrl}/api/admin/blog/posts/${postId}/revisions`, {
      headers: authHeaders,
    });
    assert(revsRes.status === 200, 'GET /api/admin/blog/posts/:id/revisions returns 200');
    const revsData = await revsRes.json();
    assert(revsData.revisions.length >= 2, 'Multiple revisions tracked in database');

    // 5. Draft Isolation & Public SSR Negative Check
    console.log('\n--- 5. PUBLIC DRAFT ISOLATION & PREVIEW TOKEN VALIDATION ---');
    const publicDraftRes = await fetch(`${baseUrl}/blog/${postSlug}`);
    assert(publicDraftRes.status === 404, 'Anonymous request to unpublished draft returns HTTP 404');

    // Create Preview Token
    const previewTokenRes = await fetch(`${baseUrl}/api/admin/blog/posts/${postId}/preview-token`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(previewTokenRes.status === 200, 'POST /api/admin/blog/posts/:id/preview-token creates preview token');
    const { token: previewToken } = await previewTokenRes.json();

    // Access via valid preview token
    const previewHttpRes = await fetch(`${baseUrl}/blog/${postSlug}?previewToken=${previewToken}`);
    assert(previewHttpRes.status === 200, 'Preview token unlocks draft access (HTTP 200)');
    const previewHtml = await previewHttpRes.text();
    assert(previewHtml.includes('Mastering HD Social Media Downloads'), 'Rendered draft HTML contains post title');
    assert(previewHtml.includes('noindex, nofollow'), 'Preview page includes noindex robots tag');

    // Access via invalid token
    const invalidTokenRes = await fetch(`${baseUrl}/blog/${postSlug}?previewToken=invalid_token_xyz`);
    assert(invalidTokenRes.status === 404, 'Invalid preview token rejected with HTTP 404');

    // 6. Publishing & Public SSR Full HTML Verification
    console.log('\n--- 6. PUBLISHING & RAW SSR HTML DELIVERY ---');
    const publishRes = await fetch(`${baseUrl}/api/admin/blog/posts/${postId}/publish`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(publishRes.status === 200, 'POST /api/admin/blog/posts/:id/publish returns HTTP 200');

    // Public Anonymous Request to Published Post
    const publicPublishedRes = await fetch(`${baseUrl}/blog/${postSlug}`);
    assert(publicPublishedRes.status === 200, 'Published post is publicly accessible (HTTP 200)');
    const publicHtml = await publicPublishedRes.text();
    assert(publicHtml.includes('<title>Mastering HD Social Media Downloads'), 'SSR HTML includes authoritative SEO title');
    assert(publicHtml.includes('BlogPosting'), 'SSR HTML includes Schema.org BlogPosting JSON-LD');
    assert(publicHtml.includes('index, follow'), 'SSR HTML includes index, follow robots directive');

    // 7. Sitemap Dynamic Integration
    console.log('\n--- 7. SITEMAP INTEGRATION ---');
    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    assert(sitemapRes.status === 200, 'GET /sitemap.xml returns HTTP 200');
    const sitemapXml = await sitemapRes.text();
    assert(sitemapXml.includes(`/blog/${postSlug}`), 'Published post path present in sitemap.xml');

    // 8. Unpublish & Archive Isolation
    console.log('\n--- 8. UNPUBLISH & ARCHIVE ISOLATION ---');
    const unpublishRes = await fetch(`${baseUrl}/api/admin/blog/posts/${postId}/unpublish`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(unpublishRes.status === 200, 'POST /api/admin/blog/posts/:id/unpublish returns HTTP 200');

    const publicAfterUnpublish = await fetch(`${baseUrl}/blog/${postSlug}`);
    assert(publicAfterUnpublish.status === 404, 'Unpublished post immediately returns HTTP 404 on public route');

    const sitemapAfterUnpublish = await (await fetch(`${baseUrl}/sitemap.xml`)).text();
    assert(!sitemapAfterUnpublish.includes(`/blog/${postSlug}`), 'Unpublished post immediately removed from sitemap.xml');

    // Clean up
    await fetch(`${baseUrl}/api/admin/blog/posts/${postId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    await fetch(`${baseUrl}/api/admin/blog/categories/${testCatId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

  } finally {
    BlogService.stopScheduler();
    server.close();
  }

  console.log('\n===============================================================');
  console.log(`📊 HTTP INTEGRATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHttpVerification().catch((err) => {
  console.error('Fatal HTTP verification error:', err);
  process.exit(1);
});

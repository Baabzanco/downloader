import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { DownloaderEngine } from './server/downloader/core/DownloaderEngine.js';
import { bootstrapAdminSystem } from './server/admin/bootstrap.js';
import { adminAuthMiddleware } from './server/admin/middleware/adminAuth.js';
import { adminAuthRouter } from './server/admin/routes/adminAuthRoutes.js';
import { adminUserRouter } from './server/admin/routes/adminUserRoutes.js';
import { adminRoleRouter } from './server/admin/routes/adminRoleRoutes.js';
import { adminAuditRouter } from './server/admin/routes/adminAuditRoutes.js';
import { adminSettingsRouter } from './server/admin/routes/adminSettingsRoutes.js';
import { adminSeoRouter } from './server/admin/routes/adminSeoRoutes.js';
import { adminContentRouter } from './server/admin/routes/adminContentRoutes.js';
import { adminMediaRouter } from './server/admin/routes/adminMediaRoutes.js';
import { adminBlogRouter } from './server/admin/routes/adminBlogRoutes.js';
import { SeoService } from './server/admin/services/seoService.js';
import { ContentService } from './server/admin/services/contentService.js';
import { MediaService } from './server/admin/services/mediaService.js';
import { BlogService } from './server/admin/services/blogService.js';
import { BlogSeeder } from './server/admin/models/blogSeeder.js';
import { BlogRepository } from './server/admin/models/blogRepository.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const isProduction = process.env.NODE_ENV === 'production';
  const engine = DownloaderEngine.getInstance();

  // Initialize Admin Database, System Roles, Permissions, and Initial Super Admin
  await bootstrapAdminSystem();

  // Ensure default CMS landing pages and initial blog guides are seeded
  ContentService.ensureDefaultPagesSeeded();
  BlogSeeder.seedDefaultBlogData();

  // Start background auto-scheduler for scheduled blog posts
  BlogService.startScheduler();

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(adminAuthMiddleware);

  // Serve uploaded media assets safely
  app.use('/uploads', express.static(MediaService.getUploadDirectory(), {
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    },
  }));

  // Helper for client IP with x-forwarded-for extraction
  const getClientIp = (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  };

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      engine: 'MediaDownloaderEngine',
      phase: '8.4',
      environment: isProduction ? 'production' : 'development',
      enabledProviders: ['tiktok', 'instagram', 'facebook', 'youtube', 'twitter', 'pinterest'],
      plannedProviders: [],
      activeDownloads: engine.downloadManager.getActiveDownloadsCount(),
      timestamp: new Date().toISOString(),
    });
  });

  // Media Resolution Endpoint
  app.post('/api/media/resolve', async (req: Request, res: Response) => {
    const { url } = req.body || {};
    const ip = getClientIp(req);

    if (!url || typeof url !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'The "url" property is required and must be a valid string.',
        },
      });
      return;
    }

    const result = await engine.resolveMedia(url, ip);

    if (result.success) {
      res.status(200).json(result);
    } else {
      const statusCode =
        result.error.code === 'RATE_LIMITED'
          ? 429
          : result.error.code === 'MEDIA_NOT_FOUND'
          ? 404
          : result.error.code === 'TIMEOUT'
          ? 504
          : result.error.code === 'UPSTREAM_ERROR'
          ? 502
          : 400;

      res.status(statusCode).json(result);
    }
  });

  // Media Streaming Download Endpoint
  app.get('/api/media/download', async (req: Request, res: Response) => {
    const token = req.query.token as string;
    const variantId = req.query.variantId as string;

    if (!token || !variantId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Both "token" and "variantId" query parameters are required.',
        },
      });
      return;
    }

    const ip = getClientIp(req);
    await engine.streamDownload(token, variantId, res, ip);
  });

  // Diagnostic Endpoint - Gated in production
  app.get('/api/media/diagnostics', (_req: Request, res: Response) => {
    if (isProduction) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Diagnostics endpoint is disabled in production mode.',
        },
      });
      return;
    }

    res.json({
      success: true,
      logs: engine.getDiagnosticLogs(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Admin API Routes
  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin/users', adminUserRouter);
  app.use('/api/admin/roles', adminRoleRouter);
  app.use('/api/admin/audit-logs', adminAuditRouter);
  app.use('/api/admin/settings', adminSettingsRouter);
  app.use('/api/admin/seo', adminSeoRouter);
  app.use('/api/admin/pages', adminContentRouter);
  app.use('/api/admin/media', adminMediaRouter);
  app.use('/api/admin/blog', adminBlogRouter);

  // Public Blog Endpoints
  app.get('/api/blog/posts', (req: Request, res: Response) => {
    try {
      const categorySlug = typeof req.query.category === 'string' ? req.query.category : undefined;
      const tagSlug = typeof req.query.tag === 'string' ? req.query.tag : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;

      const result = BlogRepository.listPosts({
        status: 'published',
        categorySlug,
        tagSlug,
        search,
        limit,
        offset,
      });

      return res.json({ success: true, posts: result.posts, total: result.total });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  app.get('/api/blog/posts/:slug', (req: Request, res: Response) => {
    try {
      const previewToken = typeof req.query.previewToken === 'string' ? req.query.previewToken : undefined;
      const resolution = BlogService.resolvePublicPost(req.params.slug, previewToken);

      if (!resolution.found) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found.' } });
      }

      if (!resolution.isPublished && !resolution.isPreview) {
        return res.status(404).json({
          success: false,
          error: { code: 'UNPUBLISHED', message: 'This article is not published.' },
        });
      }

      return res.json({
        success: true,
        post: resolution.post,
        renderedContentHtml: resolution.renderedContentHtml,
        isPreview: Boolean(resolution.isPreview),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  app.get('/api/blog/categories', (_req: Request, res: Response) => {
    try {
      const categories = BlogRepository.listCategories();
      return res.json({ success: true, categories });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  app.get('/api/blog/tags', (_req: Request, res: Response) => {
    try {
      const tags = BlogRepository.listTags();
      return res.json({ success: true, tags });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: { message: err.message } });
    }
  });

  // Public SEO Endpoints
  app.get('/sitemap.xml', (req: Request, res: Response) => {
    try {
      const origin = `${req.protocol}://${req.get('host')}`;
      const xml = SeoService.generateSitemapXml(origin);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.status(200).send(xml);
    } catch (err: any) {
      return res.status(500).send('Error generating sitemap');
    }
  });

  app.get('/robots.txt', (req: Request, res: Response) => {
    try {
      const origin = `${req.protocol}://${req.get('host')}`;
      const txt = SeoService.generateRobotsTxt(origin);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(txt);
    } catch (err: any) {
      return res.status(500).send('Error generating robots.txt');
    }
  });

  app.get('/api/seo/resolve', (req: Request, res: Response) => {
    try {
      const rawPath = typeof req.query.path === 'string' ? req.query.path : '/';
      const origin = `${req.protocol}://${req.get('host')}`;
      const result = SeoService.resolvePageSeo(rawPath, origin);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: 'FAILED_RESOLVE_SEO', message: err.message });
    }
  });

  // Public CMS Content Endpoint (with draft isolation)
  app.get('/api/pages/resolve', (req: Request, res: Response) => {
    try {
      const rawPath = typeof req.query.path === 'string' ? req.query.path : '/';
      const previewToken = typeof req.query.previewToken === 'string' ? req.query.previewToken : undefined;
      const result = ContentService.resolvePublicPage(rawPath, previewToken);

      if (!result || !result.found) {
        return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'Page not found.' });
      }

      if (!result.isPublished && !result.isPreview) {
        return res.status(404).json({
          error: 'PAGE_NOT_PUBLISHED',
          message: 'This page is currently unpublished or archived.',
          status: result.status,
        });
      }

      return res.json({
        success: true,
        page: result.page,
        sections: result.sections,
        isPreview: Boolean(result.isPreview),
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'FAILED_RESOLVE_CONTENT', message: err.message });
    }
  });

  // Vite & Dynamic HTML serving with server-rendered SEO, CMS, and Blog content
  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, 'dist'), { index: false }));

    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      // Skip API endpoints or assets
      if (req.path.startsWith('/api/') || (req.path.includes('.') && !req.path.endsWith('.html'))) {
        return next();
      }

      try {
        const origin = `${req.protocol}://${req.get('host')}`;
        const seoResult = SeoService.resolvePageSeo(req.path, origin);

        // Handle SEO Redirects server-side
        if (seoResult.redirect) {
          return res.redirect(seoResult.redirect.statusCode, seoResult.redirect.destination);
        }

        const templatePath = path.resolve(__dirname, 'dist', 'index.html');
        if (!fs.existsSync(templatePath)) {
          return res.status(500).send('Production build not found. Run npm run build.');
        }

        let template = fs.readFileSync(templatePath, 'utf-8');

        // Handle Blog Article Route Server Rendering (/blog/:slug)
        if (req.path.startsWith('/blog/') && !req.path.startsWith('/blog/category/') && !req.path.startsWith('/blog/tag/')) {
          const blogSlug = req.path.replace('/blog/', '').trim();
          if (blogSlug) {
            const previewToken = typeof req.query.previewToken === 'string' ? req.query.previewToken : undefined;
            const blogRes = BlogService.resolvePublicPost(blogSlug, previewToken);

            if (!blogRes.found) {
              return res.status(404).send('404 — Blog Article Not Found');
            }

            if (!blogRes.isPublished && !blogRes.isPreview) {
              return res.status(404).send('404 — Article Not Found (Draft Isolation)');
            }

            if (blogRes.post) {
              template = BlogService.injectBlogPostIntoHtml(template, blogRes.post, Boolean(blogRes.isPreview));
            }
          }
        }

        // Resolve CMS Landing Page Content
        const previewToken = typeof req.query.previewToken === 'string' ? req.query.previewToken : undefined;
        const cmsResult = ContentService.resolvePublicPage(req.path, previewToken);

        if (cmsResult && cmsResult.found) {
          if (!cmsResult.isPublished && !cmsResult.isPreview) {
            const isCoreDownloaderRoute = [
              '/',
              '/tiktok-video-downloader',
              '/instagram-reels-downloader',
              '/facebook-video-downloader',
              '/youtube-shorts-downloader',
              '/twitter-video-downloader',
              '/pinterest-video-downloader',
            ].includes(req.path);

            if (!isCoreDownloaderRoute && !req.path.startsWith('/blog')) {
              return res.status(404).send('404 — Page Not Found (Draft Isolation)');
            }
          } else if (cmsResult.page && cmsResult.sections) {
            template = ContentService.injectContentIntoHtml(
              template,
              cmsResult.page,
              cmsResult.sections,
              Boolean(cmsResult.isPreview)
            );
          }
        }

        if (seoResult.seo) {
          template = SeoService.injectSeoIntoHtml(template, seoResult.seo);
        }

        return res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(template);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return next();
      }

      try {
        const origin = `${req.protocol}://${req.get('host')}`;
        const seoResult = SeoService.resolvePageSeo(req.path, origin);

        // Handle SEO Redirects server-side
        if (seoResult.redirect) {
          return res.redirect(seoResult.redirect.statusCode, seoResult.redirect.destination);
        }

        const templatePath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);

        // Handle Blog Article Route Server Rendering (/blog/:slug)
        if (req.path.startsWith('/blog/') && !req.path.startsWith('/blog/category/') && !req.path.startsWith('/blog/tag/')) {
          const blogSlug = req.path.replace('/blog/', '').trim();
          if (blogSlug) {
            const previewToken = typeof req.query.previewToken === 'string' ? req.query.previewToken : undefined;
            const blogRes = BlogService.resolvePublicPost(blogSlug, previewToken);

            if (!blogRes.found) {
              return res.status(404).send('404 — Blog Article Not Found');
            }

            if (!blogRes.isPublished && !blogRes.isPreview) {
              return res.status(404).send('404 — Article Not Found (Draft Isolation)');
            }

            if (blogRes.post) {
              template = BlogService.injectBlogPostIntoHtml(template, blogRes.post, Boolean(blogRes.isPreview));
            }
          }
        }

        // Resolve CMS Content
        const previewToken = typeof req.query.previewToken === 'string' ? req.query.previewToken : undefined;
        const cmsResult = ContentService.resolvePublicPage(req.path, previewToken);

        if (cmsResult && cmsResult.found) {
          if (!cmsResult.isPublished && !cmsResult.isPreview) {
            const isCoreDownloaderRoute = [
              '/',
              '/tiktok-video-downloader',
              '/instagram-reels-downloader',
              '/facebook-video-downloader',
              '/youtube-shorts-downloader',
              '/twitter-video-downloader',
              '/pinterest-video-downloader',
            ].includes(req.path);

            if (!isCoreDownloaderRoute && !req.path.startsWith('/blog')) {
              return res.status(404).send('404 — Page Not Found (Draft Isolation)');
            }
          } else if (cmsResult.page && cmsResult.sections) {
            template = ContentService.injectContentIntoHtml(
              template,
              cmsResult.page,
              cmsResult.sections,
              Boolean(cmsResult.isPreview)
            );
          }
        }

        if (seoResult.seo) {
          template = SeoService.injectSeoIntoHtml(template, seoResult.seo);
        }

        return res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MediaDownloaderEngine] Active on http://0.0.0.0:${PORT} (${isProduction ? 'PRODUCTION' : 'DEV'})`);
  });
}

startServer().catch((err) => {
  console.error('[MediaDownloaderEngine] Fatal startup error:', err);
  process.exit(1);
});

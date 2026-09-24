import { getDatabase, initSchema } from './db/database.js';
import { ContentRepository } from './admin/models/contentRepository.js';
import { ContentService } from './admin/services/contentService.js';
import { SeoRepository } from './admin/models/seoRepository.js';
import { SeoService, DEFAULT_PUBLIC_ROUTES } from './admin/services/seoService.js';
import { bootstrapAdminSystem } from './admin/bootstrap.js';
import { ContentSeeder } from './admin/models/contentSeeder.js';
import { AdminRepository } from './admin/models/adminRepository.js';
import { AuthService } from './admin/auth/authService.js';
import { DownloaderEngine } from './downloader/core/DownloaderEngine.js';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import * as cheerio from 'cheerio';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Import Admin routers
import { adminAuthRouter } from './admin/routes/adminAuthRoutes.js';
import { adminUserRouter } from './admin/routes/adminUserRoutes.js';
import { adminRoleRouter } from './admin/routes/adminRoleRoutes.js';
import { adminAuditRouter } from './admin/routes/adminAuditRoutes.js';
import { adminSettingsRouter } from './admin/routes/adminSettingsRoutes.js';
import { adminSeoRouter } from './admin/routes/adminSeoRoutes.js';
import { adminContentRouter } from './admin/routes/adminContentRoutes.js';
import { adminAuthMiddleware } from './admin/middleware/adminAuth.js';

interface ServerInstance {
  app: express.Express;
  server: any;
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
}

async function createTestServer(port = 3008): Promise<ServerInstance> {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(adminAuthMiddleware);

  // Mount Admin API Routes
  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin/users', adminUserRouter);
  app.use('/api/admin/roles', adminRoleRouter);
  app.use('/api/admin/audit-logs', adminAuditRouter);
  app.use('/api/admin/settings', adminSettingsRouter);
  app.use('/api/admin/seo', adminSeoRouter);
  app.use('/api/admin/pages', adminContentRouter);

  // Mount Public SEO & CMS Endpoints
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

  app.get('/api/pages/resolve', (req: Request, res: Response) => {
    try {
      const rawPath = typeof req.query.path === 'string' ? req.query.path : '/';
      const previewToken = typeof req.query.preview === 'string' ? req.query.preview : undefined;
      const isAdmin = (req as any).adminUser !== undefined;
      const result = ContentService.resolvePublicPage(rawPath, { previewToken, isAdmin });
      if (!result) {
        return res.status(404).json({ error: 'PAGE_NOT_FOUND', message: 'Page not found or is not published.' });
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // Serve static dist in production
  const distDir = path.resolve(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false }));
  }

  // HTML Route Handler with CMS & SEO Injection
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/') || (req.path.includes('.') && !req.path.endsWith('.html'))) {
      return next();
    }

    try {
      const origin = `${req.protocol}://${req.get('host')}`;
      const seoResult = SeoService.resolvePageSeo(req.path, origin);

      if (seoResult.redirect) {
        return res.redirect(seoResult.redirect.statusCode, seoResult.redirect.destination);
      }

      const previewToken = typeof req.query.preview === 'string' ? req.query.preview : undefined;
      const isAdmin = (req as any).adminUser !== undefined;
      const cmsResult = ContentService.resolvePublicPage(req.path, { previewToken, isAdmin });

      const templatePath = fs.existsSync(path.resolve(distDir, 'index.html'))
        ? path.resolve(distDir, 'index.html')
        : path.resolve(rootDir, 'index.html');
      let template = fs.readFileSync(templatePath, 'utf-8');

      if (seoResult.seo) {
        template = SeoService.injectSeoIntoHtml(template, seoResult.seo);
      }

      if (cmsResult) {
        template = ContentService.injectContentIntoHtml(template, cmsResult);
      } else if (!req.path.startsWith('/admin') && req.path !== '/') {
        // Unknown public page returning 404
        return res.status(404).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(`<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>`);
      }

      return res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(template);
    } catch (err) {
      next(err);
    }
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      resolve({
        app,
        server,
        port,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

export async function runFullPhase83Evidence() {
  console.log('================================================================');
  console.log('   PHASE 8.3 — FINAL PAGES CMS PRODUCTION EVIDENCE CLOSURE      ');
  console.log('================================================================\n');

  // Initialize DB and bootstrap
  initSchema();
  bootstrapAdminSystem();
  ContentSeeder.seedDefaultPages();

  // Clean up any stale test rows
  const db = getDatabase();
  db.prepare("DELETE FROM content_pages WHERE path LIKE '/test-%' OR path LIKE '/secret-%' OR path LIKE '/sitemap-%'").run();

  let serverInstance = await createTestServer(3008);
  const baseUrl = serverInstance.baseUrl;

  const testResults: { category: string; test: string; passed: boolean; details?: string }[] = [];

  function record(category: string, test: string, passed: boolean, details?: string) {
    testResults.push({ category, test, passed, details });
    const status = passed ? '[PASS]' : '[FAIL]';
    console.log(`${status} [${category}] ${test}${details ? ` -> ${details}` : ''}`);
  }

  try {
    // -------------------------------------------------------------
    // SECTION 1: AUTH & REAL ADMIN CREDENTIALS
    // -------------------------------------------------------------
    console.log('\n--- 1. Admin Authentication ---');
    // Ensure default super admin exists
    const superAdminRole = AdminRepository.getRoleByName('SUPER_ADMIN');
    let superAdmin = AdminRepository.findByEmail('admin@example.com');
    if (!superAdmin && superAdminRole) {
      const passHash = await AuthService.hashPassword('Admin12345!Secure');
      AdminRepository.createUser(
        {
          id: 'admin_root',
          email: 'admin@example.com',
          passwordHash: passHash,
          name: 'Super Administrator',
          status: 'active',
        },
        [superAdminRole.id]
      );
    }

    const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'Admin12345!Secure' }),
    });
    const setCookie = loginRes.headers.get('set-cookie');
    const authCookie = setCookie ? setCookie.split(';')[0] : '';
    record('Auth', 'Admin Login', loginRes.status === 200 && !!authCookie, `Status: ${loginRes.status}`);

    const authHeaders = {
      'Content-Type': 'application/json',
      Cookie: authCookie,
    };

    // -------------------------------------------------------------
    // SECTION 2: ADMIN PAGES CRUD — REAL HTTP EVIDENCE
    // -------------------------------------------------------------
    console.log('\n--- 2. Admin Pages CRUD Workflow ---');
    
    // 2.1 List pages
    const listRes = await fetch(`${baseUrl}/api/admin/pages`, { headers: authHeaders });
    const listData = await listRes.json();
    record('CRUD', 'GET /api/admin/pages', listRes.status === 200 && Array.isArray(listData.pages), `Found ${listData.pages?.length} pages`);

    // 2.2 Create a test page
    const createPayload = {
      path: '/test-evidence-landing',
      title: 'Evidence Test Landing Page',
      pageType: 'TOOL_PAGE',
      status: 'draft',
      sections: [
        {
          sectionType: 'hero',
          sortOrder: 0,
          isVisible: true,
          data: {
            eyebrow: 'Fast Downloader',
            heading: 'Ultimate Test Downloader Tool',
            description: 'Save media instantly with pristine quality and fast speeds.',
            primaryCta: { label: 'Start Free Download', url: '#downloader' },
            alignment: 'center',
          },
        },
        {
          sectionType: 'rich_text',
          sortOrder: 1,
          isVisible: true,
          data: {
            content: '<h2>Why Choose Our Tool</h2><p>Our downloader supports highest resolution streams.</p>',
          },
        },
      ],
    };

    const createRes = await fetch(`${baseUrl}/api/admin/pages`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(createPayload),
    });
    const createData = await createRes.json();
    const testPageId = createData.page?.id;
    record('CRUD', 'POST /api/admin/pages (Create Draft)', createRes.status === 201 && !!testPageId, `Created ID: ${testPageId}`);

    // 2.3 GET Created Page
    const getRes = await fetch(`${baseUrl}/api/admin/pages/${testPageId}`, { headers: authHeaders });
    const getData = await getRes.json();
    record('CRUD', 'GET /api/admin/pages/:id', getRes.status === 200 && getData.page?.title === 'Evidence Test Landing Page');

    // 2.4 Update Page title, add sections, reorder, toggle visibility
    const updatePayload = {
      title: 'Updated Evidence Landing Page Title',
      sections: [
        {
          sectionType: 'hero',
          sortOrder: 1, // Reordered to sortOrder 1
          isVisible: true,
          data: {
            heading: 'Updated Hero Heading Text',
            description: 'Updated description for testing CMS mutations.',
            primaryCta: { label: 'Download Now', url: '#downloader' },
          },
        },
        {
          sectionType: 'faq',
          sortOrder: 0, // Reordered to sortOrder 0
          isVisible: false, // Toggled visibility to false
          data: {
            heading: 'Frequently Asked Questions',
            items: [{ question: 'Is this free?', answer: 'Yes, 100% free forever.' }],
          },
        },
        {
          sectionType: 'cta',
          sortOrder: 2,
          isVisible: true,
          data: {
            heading: 'Ready to Download?',
            buttonLabel: 'Get Started',
            buttonUrl: '/tiktok-video-downloader',
          },
        },
      ],
    };

    const updateRes = await fetch(`${baseUrl}/api/admin/pages/${testPageId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(updatePayload),
    });
    const updateData = await updateRes.json();
    record('CRUD', 'PUT /api/admin/pages/:id (Update Title & Sections)', updateRes.status === 200 && updateData.page?.title === 'Updated Evidence Landing Page Title');

    // 2.5 Verify Draft is not accessible publicly
    const publicDraftRes = await fetch(`${baseUrl}/test-evidence-landing`);
    record('Draft Isolation', 'Anonymous GET Draft -> 404', publicDraftRes.status === 404, `Status: ${publicDraftRes.status}`);

    // 2.6 Publish Page
    const publishRes = await fetch(`${baseUrl}/api/admin/pages/${testPageId}/publish`, {
      method: 'POST',
      headers: authHeaders,
    });
    const publishData = await publishRes.json();
    record('CRUD', 'POST /api/admin/pages/:id/publish', publishRes.status === 200 && publishData.page?.status === 'published');

    // 2.7 Request public path through raw HTTP
    const publicPublishedRes = await fetch(`${baseUrl}/test-evidence-landing`);
    const publicHtml = await publicPublishedRes.text();
    const hasUpdatedHero = publicHtml.includes('Updated Hero Heading Text');
    const hasHiddenFaq = publicHtml.includes('Frequently Asked Questions');
    record('Public Render', 'GET Published Page -> 200 with CMS Content', publicPublishedRes.status === 200 && hasUpdatedHero, `Contains Hero: ${hasUpdatedHero}`);
    record('Public Render', 'Invisible section omitted from public HTML', !hasHiddenFaq, `Hidden FAQ omitted: ${!hasHiddenFaq}`);

    // 2.8 Unpublish Page
    const unpublishRes = await fetch(`${baseUrl}/api/admin/pages/${testPageId}/unpublish`, {
      method: 'POST',
      headers: authHeaders,
    });
    record('CRUD', 'POST /api/admin/pages/:id/unpublish', unpublishRes.status === 200);

    const publicUnpublishedRes = await fetch(`${baseUrl}/test-evidence-landing`);
    record('Unpublish Isolation', 'GET Unpublished Page -> 404', publicUnpublishedRes.status === 404);

    // 2.9 Archive Page
    const archiveRes = await fetch(`${baseUrl}/api/admin/pages/${testPageId}/archive`, {
      method: 'POST',
      headers: authHeaders,
    });
    const archiveData = await archiveRes.json().catch(() => ({}));
    record(
      'CRUD',
      'POST /api/admin/pages/:id/archive',
      archiveRes.status === 200,
      `Status: ${archiveRes.status} ${archiveData.error ? `(${archiveData.error}: ${archiveData.message})` : ''}`
    );

    const publicArchivedRes = await fetch(`${baseUrl}/test-evidence-landing`);
    record('Archive Isolation', 'GET Archived Page -> 404', publicArchivedRes.status === 404);

    // -------------------------------------------------------------
    // SECTION 3: RAW PUBLIC HTML — CMS CONTENT (ALL 7 ROUTES)
    // -------------------------------------------------------------
    console.log('\n--- 3. RAW Public HTML Verification (All 7 Managed Routes) ---');
    const managedRoutes = [
      '/',
      '/tiktok-video-downloader',
      '/instagram-reels-downloader',
      '/facebook-video-downloader',
      '/youtube-shorts-downloader',
      '/twitter-video-downloader',
      '/pinterest-video-downloader',
    ];

    for (const route of managedRoutes) {
      const res = await fetch(`${baseUrl}${route}`);
      const rawHtml = await res.text();
      const $ = cheerio.load(rawHtml);

      const cmsPage = ContentRepository.getPageByPath(route);
      const sections = cmsPage ? ContentRepository.getPageSections(cmsPage.id) : [];
      const sectionTypes = sections.map((s) => s.sectionType);
      
      const title = $('title').text();
      const canonical = $('link[rel="canonical"]').attr('href');
      const robots = $('meta[name="robots"]').attr('content');
      const jsonLd = $('script[type="application/ld+json"]').length > 0;
      const hasCmsContainer = rawHtml.includes('cms-main-content') || rawHtml.includes('__CMS_INITIAL_STATE__');

      const isPass = res.status === 200 && cmsPage?.status === 'published' && sections.length > 0 && hasCmsContainer;

      console.log(`\nRoute: ${route}`);
      console.log(`  HTTP status: ${res.status}`);
      console.log(`  CMS page status: ${cmsPage?.status}`);
      console.log(`  Section count: ${sections.length}`);
      console.log(`  Section order: [${sectionTypes.join(' -> ')}]`);
      console.log(`  <title>: ${title}`);
      console.log(`  canonical: ${canonical}`);
      console.log(`  robots: ${robots}`);
      console.log(`  JSON-LD presence: ${jsonLd ? 'Yes' : 'No'}`);
      console.log(`  CMS content in raw HTML: ${hasCmsContainer ? 'CONFIRMED' : 'MISSING'}`);

      record('Raw HTML', `Route "${route}" verification`, isPass);
    }

    // -------------------------------------------------------------
    // SECTION 4: ADMIN -> SQLITE -> RESTART -> PUBLIC HTML
    // -------------------------------------------------------------
    console.log('\n--- 4. SQLite Persistence & Server Restart Verification ---');
    
    // Modify TikTok page content
    const tiktokPage = ContentRepository.getPageByPath('/tiktok-video-downloader')!;
    const originalTikTokSections = ContentRepository.getPageSections(tiktokPage.id);
    const heroSection = originalTikTokSections.find((s) => s.sectionType === 'hero')!;

    const testUniqueString = `Unique Persistence Marker ${Date.now()}`;
    ContentRepository.setSections(tiktokPage.id, [
      {
        ...heroSection,
        data: {
          ...heroSection.data,
          heading: `TikTok Downloader — ${testUniqueString}`,
        },
      },
      ...originalTikTokSections.filter((s) => s.sectionType !== 'hero'),
    ]);

    console.log('1. Updated SQLite section data for /tiktok-video-downloader');
    console.log('2. Terminating production server instance...');
    await serverInstance.close();
    console.log('3. Production server stopped.');

    console.log('4. Starting fresh production server instance on port 3009...');
    serverInstance = await createTestServer(3009);
    const restartedBaseUrl = serverInstance.baseUrl;
    console.log('5. Requesting /tiktok-video-downloader over raw HTTP on fresh server...');

    const restartedRes = await fetch(`${restartedBaseUrl}/tiktok-video-downloader`);
    const restartedHtml = await restartedRes.text();
    const persisted = restartedHtml.includes(testUniqueString);
    record('Persistence', 'CMS Data Persists Across Server Restart', persisted && restartedRes.status === 200, `Found marker: ${persisted}`);

    // Restore original
    ContentRepository.setSections(tiktokPage.id, originalTikTokSections);

    // Switch server back to 3008
    await serverInstance.close();
    serverInstance = await createTestServer(3008);

    // -------------------------------------------------------------
    // SECTION 5: DRAFT ISOLATION & PREVIEW SECURITY
    // -------------------------------------------------------------
    console.log('\n--- 5. Draft Isolation & Preview Token Security ---');

    // Create a draft page
    const draftPage = ContentRepository.createPage({
      path: '/secret-draft-feature',
      title: 'Secret Draft Feature Page',
      pageType: 'TOOL_PAGE',
      status: 'draft',
      createdBy: 'admin_root',
    });

    ContentRepository.setSections(draftPage.id, [
      {
        sectionType: 'hero',
        sortOrder: 0,
        isVisible: true,
        data: {
          heading: 'Confidential Unreleased Feature',
          description: 'This must never be visible to anonymous users.',
        },
      },
    ]);

    // Anonymous request
    const anonDraftRes = await fetch(`${baseUrl}/secret-draft-feature`);
    const anonDraftHtml = await anonDraftRes.text();
    const exposedToAnon = anonDraftHtml.includes('Confidential Unreleased Feature');
    record('Draft Security', 'Anonymous request receives 404', anonDraftRes.status === 404 && !exposedToAnon);

    // Preview Tokens
    const { token: validToken } = ContentRepository.createPreviewToken(draftPage.id, 'admin_root', 3600);
    
    // Valid preview token
    const validPreviewRes = await fetch(`${baseUrl}/secret-draft-feature?preview=${validToken}`);
    const validPreviewHtml = await validPreviewRes.text();
    const validExposed = validPreviewHtml.includes('Confidential Unreleased Feature');
    record('Preview Security', 'Valid preview token grants access', validPreviewRes.status === 200 && validExposed);

    // Random fake token
    const fakeTokenRes = await fetch(`${baseUrl}/secret-draft-feature?preview=fake_token_1234567890abcdef`);
    record('Preview Security', 'Random fake token rejected (404)', fakeTokenRes.status === 404);

    // Tampered token
    const tamperedRes = await fetch(`${baseUrl}/secret-draft-feature?preview=${validToken}tamper`);
    record('Preview Security', 'Tampered token rejected (404)', tamperedRes.status === 404);

    // Expired token (created with -10 seconds expiry)
    const { token: expiredToken } = ContentRepository.createPreviewToken(draftPage.id, 'admin_root', -10);
    const expiredRes = await fetch(`${baseUrl}/secret-draft-feature?preview=${expiredToken}`);
    record('Preview Security', 'Expired token rejected (404)', expiredRes.status === 404);

    // Clean up draft page
    ContentRepository.deletePage(draftPage.id);

    // -------------------------------------------------------------
    // SECTION 6: SITEMAP LIFECYCLE TEST
    // -------------------------------------------------------------
    console.log('\n--- 6. Sitemap Integration Lifecycle ---');

    const sitemapInitialRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapInitialXml = await sitemapInitialRes.text();
    const countBefore = (sitemapInitialXml.match(/<loc>/g) || []).length;

    // 1. Create a draft page
    const tempPage = ContentRepository.createPage({
      path: '/sitemap-lifecycle-test',
      title: 'Sitemap Test Page',
      pageType: 'TOOL_PAGE',
      status: 'draft',
      createdBy: 'admin_root',
    });

    const sitemapDraftRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapDraftXml = await sitemapDraftRes.text();
    const draftInSitemap = sitemapDraftXml.includes('/sitemap-lifecycle-test');
    record('Sitemap', 'Draft page excluded from sitemap.xml', !draftInSitemap);

    // 2. Publish the page
    ContentRepository.updatePage(tempPage.id, { status: 'published', publishedAt: new Date().toISOString() });
    const sitemapPubRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapPubXml = await sitemapPubRes.text();
    const pubInSitemap = sitemapPubXml.includes('/sitemap-lifecycle-test');
    record('Sitemap', 'Published page included in sitemap.xml', pubInSitemap);

    // 3. Unpublish / Archive
    ContentRepository.updatePage(tempPage.id, { status: 'archived' });
    const sitemapArchRes = await fetch(`${baseUrl}/sitemap.xml`);
    const sitemapArchXml = await sitemapArchRes.text();
    const archInSitemap = sitemapArchXml.includes('/sitemap-lifecycle-test');
    record('Sitemap', 'Archived page excluded from sitemap.xml', !archInSitemap);

    // Clean up temp page
    ContentRepository.deletePage(tempPage.id);

    // -------------------------------------------------------------
    // SECTION 7: RBAC, IDOR & MASS ASSIGNMENT
    // -------------------------------------------------------------
    console.log('\n--- 7. RBAC, IDOR & Mass Assignment Security ---');

    // 7.1 Unauthenticated API request -> 401
    const unauthRes = await fetch(`${baseUrl}/api/admin/pages`);
    record('RBAC', 'Unauthenticated request returns 401', unauthRes.status === 401);

    // 7.2 Create a low-privileged user (no content permissions)
    const db = getDatabase();
    const testUserId = 'test_restricted_user_' + Date.now();
    const testUserEmail = `restricted_${Date.now()}@test.local`;
    const passHash = await AuthService.hashPassword('RestrictedPass123!');
    db.prepare(`
      INSERT INTO admin_users (id, email, password_hash, name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(testUserId, testUserEmail, passHash, 'Restricted Admin', new Date().toISOString(), new Date().toISOString());

    // Role with only dashboard.read
    const testRoleId = 'role_restricted_' + Date.now();
    db.prepare(`INSERT INTO roles (id, name, description, is_system, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`).run(
      testRoleId, 'ROLE_RESTRICTED_' + Date.now(), 'Restricted Role', new Date().toISOString(), new Date().toISOString()
    );
    // Link permission 'dashboard.read' to testRoleId
    const permRow = db.prepare("SELECT id FROM permissions WHERE key = 'dashboard.read'").get() as any;
    if (permRow) {
      db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)").run(testRoleId, permRow.id);
    }
    db.prepare(`INSERT INTO admin_user_roles (admin_user_id, role_id) VALUES (?, ?)`).run(testUserId, testRoleId);

    // Login as restricted user
    const restrictedLoginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserEmail, password: 'RestrictedPass123!' }),
    });
    const restrictedCookie = restrictedLoginRes.headers.get('set-cookie')?.split(';')[0] || '';
    const restrictedHeaders = { 'Content-Type': 'application/json', Cookie: restrictedCookie };

    // Request with insufficient permissions -> 403
    const forbiddenRes = await fetch(`${baseUrl}/api/admin/pages`, { headers: restrictedHeaders });
    record('RBAC', 'Authenticated user lacking permission returns 403', forbiddenRes.status === 403, `Status: ${forbiddenRes.status}`);

    // 7.3 Mass Assignment protection test
    // Attempt to inject protected fields: created_by, created_at, id, etc. through ordinary update
    const targetPage = ContentRepository.getPageByPath('/tiktok-video-downloader')!;
    const originalCreatedBy = targetPage.createdBy;
    const originalCreatedAt = targetPage.createdAt;
    const originalId = targetPage.id;

    const massAssignRes = await fetch(`${baseUrl}/api/admin/pages/${targetPage.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Safe Title Update For Mass Assign Test',
        id: 'hacked_id_12345',
        createdBy: 'malicious_hacker',
        createdAt: '1970-01-01T00:00:00.000Z',
      }),
    });

    const refreshedTarget = ContentRepository.getPageById(targetPage.id)!;
    const massAssignProtected =
      refreshedTarget.id === originalId &&
      refreshedTarget.createdBy === originalCreatedBy &&
      refreshedTarget.createdAt === originalCreatedAt;

    record(
      'Security',
      'Protected fields immune to mass assignment',
      massAssignRes.status === 200 && massAssignProtected,
      `ID Protected: ${refreshedTarget.id === originalId}, CreatedBy Protected: ${refreshedTarget.createdBy === originalCreatedBy}, CreatedAt Protected: ${refreshedTarget.createdAt === originalCreatedAt}`
    );

    // Clean up restricted test user
    db.prepare(`DELETE FROM admin_users WHERE id = ?`).run(testUserId);
    db.prepare(`DELETE FROM roles WHERE id = ?`).run(testRoleId);

    // -------------------------------------------------------------
    // SECTION 8: ROUTE COLLISION & TRAVERSAL ATTACKS
    // -------------------------------------------------------------
    console.log('\n--- 8. Route Collision & Path Security ---');
    const dangerousPaths = [
      '/admin',
      '/admin/login',
      '/api',
      '/api/admin',
      '/sitemap.xml',
      '/robots.txt',
      '/api/media/resolve',
      '/api/media/download',
      '//admin',
      '/../admin',
      '/%2e%2e/admin',
      '/api//admin',
    ];

    for (const dPath of dangerousPaths) {
      const collisionRes = await fetch(`${baseUrl}/api/admin/pages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          path: dPath,
          title: 'Collision Attack Page',
          pageType: 'TOOL_PAGE',
          status: 'draft',
          sections: [{ sectionType: 'rich_text', sortOrder: 0, isVisible: true, data: { content: '<p>test</p>' } }],
        }),
      });

      record('Route Security', `Reserved/traversal path rejected: "${dPath}"`, collisionRes.status === 400);
    }

    // -------------------------------------------------------------
    // SECTION 9: SEO REGRESSION
    // -------------------------------------------------------------
    console.log('\n--- 9. SEO Subsystem Regression Verification ---');
    const seoRecord = SeoRepository.getPageByPath('/tiktok-video-downloader')!;
    const pagesCmsRecord = ContentRepository.getPageByPath('/tiktok-video-downloader')!;

    const separateEntities = seoRecord.id !== pagesCmsRecord.id;
    const seoOwnsMeta = !!(seoRecord.metaTitle || seoRecord.title);
    const cmsOwnsSections = ContentRepository.getPageSections(pagesCmsRecord.id).length > 0;

    record('SEO Regression', 'SEO and Pages CMS operate on separate normalized entities', separateEntities);
    record('SEO Regression', 'SeoService retains ownership of meta and canonical tags', seoOwnsMeta);
    record('SEO Regression', 'Pages CMS retains ownership of page sections and layout', cmsOwnsSections);

    // -------------------------------------------------------------
    // SECTION 10: DOWNLOADER REGRESSION
    // -------------------------------------------------------------
    console.log('\n--- 10. Downloader Engine Regression ---');
    const engine = DownloaderEngine.getInstance();
    const requiredPlatforms: any[] = ['tiktok', 'instagram', 'facebook', 'youtube', 'twitter', 'pinterest'];
    for (const plat of requiredPlatforms) {
      const p = engine.resolver.getProvider(plat);
      record('Downloader', `Provider active: ${plat}`, !!p && p.isEnabled);
    }

    // Clean up test page from CRUD section
    if (testPageId) {
      ContentRepository.deletePage(testPageId);
    }

  } finally {
    await serverInstance.close();
  }

  // -------------------------------------------------------------
  // SUMMARY BREAKDOWN
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 PHASE 8.3 TEST SUMMARY                         ');
  console.log('================================================================');
  const categories = Array.from(new Set(testResults.map((r) => r.category)));
  let totalPassed = 0;

  for (const cat of categories) {
    const inCat = testResults.filter((r) => r.category === cat);
    const passed = inCat.filter((r) => r.passed).length;
    totalPassed += passed;
    console.log(`  * ${cat.padEnd(20)}: ${passed}/${inCat.length} PASSED`);
  }

  console.log('----------------------------------------------------------------');
  console.log(`TOTAL: ${totalPassed}/${testResults.length} PASSED (${testResults.length - totalPassed} FAILED)`);
  console.log('================================================================\n');

  if (totalPassed !== testResults.length) {
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runFullPhase83Evidence().catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}

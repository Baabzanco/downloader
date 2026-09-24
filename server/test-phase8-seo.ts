import { getDatabase, initSchema } from './db/database.js';
import { SeoRepository } from './admin/models/seoRepository.js';
import { SeoService, escapeHtml, escapeJsonForScript } from './admin/services/seoService.js';
import { bootstrapAdminSystem } from './admin/bootstrap.js';
import { AuthService } from './admin/auth/authService.js';
import { AdminRepository } from './admin/models/adminRepository.js';
import { DownloaderEngine } from './downloader/core/DownloaderEngine.js';
import crypto from 'crypto';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
    testsFailed++;
  }
}

async function runSeoTests() {
  console.log('\n======================================================');
  console.log('PHASE 8.2 — ADVANCED TECHNICAL SEO & CMS VERIFICATION');
  console.log('======================================================\n');

  // 1. Initialize schema and bootstrap
  console.log('--- Step 1: Database Initialization & SEO Seed Data ---');
  initSchema();
  await bootstrapAdminSystem();

  const pages = SeoRepository.listPages();
  assert(pages.length >= 7, 'SeoRepository has seeded all default public routes', `Found ${pages.length} pages`);

  const homePage = SeoRepository.getPageByPath('/');
  assert(Boolean(homePage), 'Home page (/) SEO record exists in database');
  assert(homePage?.schemaType === 'SoftwareApplication', 'Home page has SoftwareApplication schema type');

  const tiktokPage = SeoRepository.getPageByPath('/tiktok-video-downloader');
  assert(Boolean(tiktokPage), 'TikTok route SEO record exists in database');
  assert(tiktokPage?.robotsIndex === true, 'TikTok page is indexable');

  const redirects = SeoRepository.listRedirects();
  assert(redirects.length >= 1, 'SeoRepository has seeded initial 301 redirects');
  const igRedirect = SeoRepository.getRedirectBySource('/instagram-video-downloader');
  assert(Boolean(igRedirect), 'Legacy IG redirect exists');
  assert(igRedirect?.destinationPath === '/instagram-reels-downloader', 'IG redirect points to /instagram-reels-downloader');
  assert(igRedirect?.statusCode === 301, 'IG redirect is permanent 301');

  const settings = SeoRepository.getSettings();
  assert(Boolean(settings.public_site_url), 'public_site_url setting exists');
  assert(Boolean(settings.default_title_suffix), 'default_title_suffix setting exists');

  // 2. SEO Resolution Service
  console.log('\n--- Step 2: SEO Resolution Engine ---');
  const resolvedHome = SeoService.resolvePageSeo('/', 'http://localhost:3000');
  assert(Boolean(resolvedHome.seo), 'Home route resolves valid SEO object');
  assert(Boolean(resolvedHome.seo?.title.includes('Universal Social Media')), 'Home title correctly populated');
  assert(resolvedHome.seo?.robots === 'index, follow, max-image-preview:large', 'Robots string properly formatted');
  assert(Boolean(resolvedHome.seo?.canonicalUrl.endsWith('/')), 'Canonical URL well-formed for root');

  const resolvedRedirect = SeoService.resolvePageSeo('/instagram-video-downloader');
  assert(Boolean(resolvedRedirect.redirect), 'Redirect route resolves redirect payload');
  assert(resolvedRedirect.redirect?.destination === '/instagram-reels-downloader', 'Redirect destination matches');
  assert(resolvedRedirect.redirect?.statusCode === 301, 'Redirect status code is 301');

  // 3. Security & XSS Protection in Head Injection
  console.log('\n--- Step 3: Head Injection & XSS Immunity ---');
  const rawHtml = '<!DOCTYPE html><html><head><title>Initial</title></head><body><div id="root"></div></body></html>';
  
  const testSeo = {
    path: '/xss-test',
    title: 'Test <script>alert(1)</script> & "Title"',
    metaDescription: 'Desc with "quotes" and <tags>',
    canonicalUrl: 'https://example.com/xss-test',
    robots: 'index, follow',
    h1: 'Test H1',
    og: {
      title: 'OG "Title"',
      description: 'OG <Desc>',
      url: 'https://example.com/xss-test',
      type: 'website',
      siteName: 'Media Downloader',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'TW "Title"',
      description: 'TW <Desc>',
    },
    schemaJson: '{"@type":"WebPage","name":"XSS \\u003c/script\\u003e"}',
    breadcrumbs: [],
    faqs: [],
  };

  const injectedHtml = SeoService.injectSeoIntoHtml(rawHtml, testSeo);
  assert(injectedHtml.includes('<title>Test &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Title&quot;</title>'), 'HTML entities escaped in <title>');
  assert(injectedHtml.includes('content="Desc with &quot;quotes&quot; and &lt;tags&gt;"'), 'HTML entities escaped in meta description');
  assert(!injectedHtml.includes('<script>alert(1)</script>'), 'No unescaped script tags in title or meta tags');
  assert(injectedHtml.includes('<script id="seo-structured-data" type="application/ld+json">'), 'Structured data script tag injected properly');

  // 4. Dynamic Sitemap.xml & Robots.txt Generation
  console.log('\n--- Step 4: Sitemap.xml & Robots.txt Generation ---');
  const sitemapXml = SeoService.generateSitemapXml('https://media-downloader.app');
  assert(sitemapXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Sitemap has XML declaration');
  assert(sitemapXml.includes('<loc>https://media-downloader.app</loc>'), 'Sitemap includes root URL');
  assert(sitemapXml.includes('<loc>https://media-downloader.app/tiktok-video-downloader</loc>'), 'Sitemap includes tool URL');
  assert(!sitemapXml.includes('/instagram-video-downloader'), 'Sitemap excludes redirected URLs');

  const robotsTxt = SeoService.generateRobotsTxt('https://media-downloader.app');
  assert(robotsTxt.includes('Disallow: /admin'), 'Robots.txt blocks /admin');
  assert(robotsTxt.includes('Disallow: /api/admin/'), 'Robots.txt blocks /api/admin/');
  assert(robotsTxt.includes('Sitemap: https://media-downloader.app/sitemap.xml'), 'Robots.txt references sitemap');

  // 5. Technical SEO Health Auditing
  console.log('\n--- Step 5: SEO Health Auditor ---');
  const reports = SeoService.runHealthAudit();
  assert(reports.length >= 7, 'Health audit inspected all configured pages');
  const homeReport = reports.find((r) => r.path === '/');
  assert(Boolean(homeReport), 'Home page report exists');
  assert(homeReport?.scoreDetails.isIndexable === true, 'Home page identified as indexable');
  assert(homeReport?.issues.length! > 0, 'Health check evaluates issues and warnings');

  // 6. Real-Time Admin Mutation to Public Output Pipeline
  console.log('\n--- Step 6: Real-Time Mutation to Public HTML Pipeline ---');
  // Read current TikTok page
  const originalTiktok = SeoRepository.getPageByPath('/tiktok-video-downloader')!;
  const originalTitle = originalTiktok.title;

  // Admin updates title
  const updatedTitle = 'Download TikTok Videos Online — Fast Free HD MP4';
  SeoRepository.upsertPage({
    ...originalTiktok,
    title: updatedTitle,
    metaTitle: updatedTitle,
  });

  // Verify resolution reflects update immediately
  const reResolved = SeoService.resolvePageSeo('/tiktok-video-downloader');
  assert(Boolean(reResolved.seo?.title.startsWith('Download TikTok Videos Online')), 'Resolution immediately reflects database update');

  // Verify injected HTML reflects update immediately
  const publicHtml = SeoService.injectSeoIntoHtml(rawHtml, reResolved.seo!);
  assert(publicHtml.includes('<title>Download TikTok Videos Online'), 'Public HTML <title> immediately updated');

  // Restore original
  SeoRepository.upsertPage({
    ...originalTiktok,
    title: originalTitle,
    metaTitle: originalTitle,
  });

  // 7. Security Permissions & Role Control
  console.log('\n--- Step 7: Security & Role-Based Access Control ---');
  const seoRole = AdminRepository.getRoleByName('SEO_MANAGER');
  assert(Boolean(seoRole), 'SEO_MANAGER role exists');
  const seoRoleData = AdminRepository.getRoleById(seoRole!.id);
  const permKeys = (seoRoleData?.permissions || []).map((p) => p.key);
  assert(permKeys.includes('seo.pages.read'), 'SEO_MANAGER has seo.pages.read');
  assert(permKeys.includes('seo.pages.write'), 'SEO_MANAGER has seo.pages.write');
  assert(permKeys.includes('seo.redirects.read'), 'SEO_MANAGER has seo.redirects.read');
  assert(permKeys.includes('seo.redirects.write'), 'SEO_MANAGER has seo.redirects.write');
  assert(permKeys.includes('seo.health.read'), 'SEO_MANAGER has seo.health.read');
  assert(!permKeys.includes('admin.users.write'), 'SEO_MANAGER cannot modify administrator accounts');

  // 8. Downloader Engine Preservation
  console.log('\n--- Step 8: Downloader Engine Integrity ---');
  const engine = DownloaderEngine.getInstance();
  const platforms = ['tiktok', 'instagram', 'facebook', 'youtube', 'twitter', 'pinterest'] as const;
  for (const plat of platforms) {
    const provider = engine.resolver.getProvider(plat);
    assert(Boolean(provider), `MediaProvider for ${plat} is registered and active`);
  }

  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runSeoTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

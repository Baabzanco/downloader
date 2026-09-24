import { ContentRepository } from './admin/models/contentRepository.js';
import { ContentService } from './admin/services/contentService.js';
import {
  validateSectionData,
  validatePathSecurity,
  normalizeCmsPath,
  ContentValidationError,
} from './admin/services/contentValidationService.js';
import { SeoRepository } from './admin/models/seoRepository.js';
import { SeoService } from './admin/services/seoService.js';
import { getDatabase } from './db/database.js';

async function runPhase83Verification() {
  console.log('================================================================');
  console.log('      PHASE 8.3 — PAGES / LANDING CMS VERIFICATION SUITE       ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const db = getDatabase();
  ContentService.ensureDefaultPagesSeeded();

  /* -------------------------------------------------------------------------
   * 1. DATABASE SCHEMA & SEEDING INTEGRITY
   * ------------------------------------------------------------------------- */
  console.log('--- 1. Database Schema & Normalization ---');

  // Verify tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  const tableNames = tables.map((t) => t.name);
  assert(tableNames.includes('content_pages'), 'content_pages table exists in SQLite');
  assert(tableNames.includes('content_page_sections'), 'content_page_sections table exists in SQLite');

  // Verify seeded pages
  const seededPages = ContentRepository.listPages();
  assert(seededPages.length >= 7, `Seeded core pages exist (Found ${seededPages.length} pages)`);

  const expectedPaths = [
    '/',
    '/tiktok-video-downloader',
    '/instagram-reels-downloader',
    '/facebook-video-downloader',
    '/youtube-shorts-downloader',
    '/twitter-video-downloader',
    '/pinterest-video-downloader',
  ];

  for (const p of expectedPaths) {
    const found = ContentRepository.getPageByPath(p);
    assert(!!found, `Core route "${p}" is seeded in content_pages`);
    if (found) {
      assert(found.status === 'published', `Core route "${p}" is in published status`);
      const sections = ContentRepository.getPageSections(found.id);
      assert(sections.length >= 4, `Core route "${p}" contains ordered structured sections (Count: ${sections.length})`);
    }
  }

  /* -------------------------------------------------------------------------
   * 2. SECTION SYSTEM & TYPES
   * ------------------------------------------------------------------------- */
  console.log('\n--- 2. Section System & Validation ---');

  const homePage = ContentRepository.getPageByPath('/')!;
  const homeSections = ContentRepository.getPageSections(homePage.id);
  const sectionTypes = homeSections.map((s) => s.sectionType);
  assert(sectionTypes.includes('hero'), 'Homepage contains Hero section');
  assert(sectionTypes.includes('feature_grid'), 'Homepage contains Feature Grid section');
  assert(sectionTypes.includes('how_to'), 'Homepage contains How-To section');
  assert(sectionTypes.includes('faq'), 'Homepage contains FAQ section');
  assert(sectionTypes.includes('cta'), 'Homepage contains CTA section');
  assert(sectionTypes.includes('related_tools'), 'Homepage contains Related Tools section');

  // Test section data validation
  const validHero = {
    eyebrow: 'Fast Downloader',
    heading: 'Download MP4',
    description: 'High speed download service',
    alignment: 'center',
    primaryCta: { label: 'Start Now', url: '#downloader' },
  };
  const sanitizedHero = validateSectionData('hero', validHero);
  assert(sanitizedHero.heading === 'Download MP4', 'Valid Hero data validates correctly');

  // Test XSS stripping in Hero
  const xssHero = {
    heading: 'Safe Title <script>alert("xss")</script>',
    description: 'Safe Description <img src=x onerror=alert(1)>',
    primaryCta: { label: 'Click <b onmouseover=evil()>Me</b>', url: 'https://example.com' },
  };
  const cleanHero = validateSectionData('hero', xssHero);
  assert(!cleanHero.heading.includes('<script>'), 'XSS <script> tag sanitized in Hero heading');
  assert(!cleanHero.description.includes('onerror='), 'XSS onerror handler sanitized in Hero description');
  assert(!cleanHero.primaryCta.label.includes('onmouseover='), 'XSS onmouseover sanitized in CTA label');

  // Test dangerous URL rejection
  try {
    validateSectionData('cta', {
      heading: 'Call To Action',
      buttonLabel: 'Click Me',
      buttonUrl: 'javascript:alert(1)',
    });
    assert(false, 'Dangerous javascript: URL in CTA should be rejected');
  } catch (err: any) {
    assert(err instanceof ContentValidationError, 'Dangerous javascript: URL correctly rejected with ContentValidationError');
  }

  try {
    validateSectionData('hero', {
      heading: 'Hero',
      primaryCta: { label: 'Click', url: 'data:text/html,<script>alert(1)</script>' },
    });
    assert(false, 'Dangerous data: URL in Hero CTA should be rejected');
  } catch (err: any) {
    assert(err instanceof ContentValidationError, 'Dangerous data: URL correctly rejected with ContentValidationError');
  }

  // Test Related Tools validation
  const validRelatedTools = {
    heading: 'Other Downloaders',
    tools: [
      { route: '/tiktok-video-downloader', label: 'TikTok' },
      { route: '/instagram-reels-downloader', label: 'Instagram' },
    ],
  };
  const cleanRelated = validateSectionData('related_tools', validRelatedTools);
  assert(cleanRelated.tools.length === 2, 'Valid related tools validate successfully');

  try {
    validateSectionData('related_tools', {
      heading: 'Unsafe Tools',
      tools: [{ route: 'https://malicious-external-site.com', label: 'Evil' }],
    });
    assert(false, 'External malicious URL in related_tools should be rejected');
  } catch (err: any) {
    assert(err instanceof ContentValidationError, 'External malicious route correctly rejected from related_tools');
  }

  /* -------------------------------------------------------------------------
   * 3. PATH SECURITY & SYSTEM ROUTE PROTECTION
   * ------------------------------------------------------------------------- */
  console.log('\n--- 3. Path Security & Shadowing Prevention ---');

  const safePath = normalizeCmsPath('/new-custom-tool');
  assert(safePath === '/new-custom-tool', 'Valid path normalized correctly');

  try {
    validatePathSecurity('/admin');
    assert(false, 'Path /admin should be rejected');
  } catch (err: any) {
    assert(err instanceof ContentValidationError, 'Path /admin correctly rejected (cannot shadow admin console)');
  }

  try {
    validatePathSecurity('/api/downloader');
    assert(false, 'Path /api/* should be rejected');
  } catch (err: any) {
    assert(err instanceof ContentValidationError, 'Path /api/* correctly rejected (cannot shadow backend APIs)');
  }

  try {
    validatePathSecurity('/robots.txt');
    assert(false, 'Path /robots.txt should be rejected');
  } catch (err: any) {
    assert(err instanceof ContentValidationError, 'Path /robots.txt correctly rejected (cannot shadow static SEO files)');
  }

  /* -------------------------------------------------------------------------
   * 4. DRAFT ISOLATION & CRYPTOGRAPHIC PREVIEWS
   * ------------------------------------------------------------------------- */
  console.log('\n--- 4. Draft Isolation & Cryptographic Previews ---');

  // Create a draft test page
  const testDraftPath = `/test-draft-page-${Date.now()}`;
  const draftPage = ContentRepository.createPage({
    path: testDraftPath,
    title: 'Unpublished Draft Test Page',
    pageType: 'LANDING_PAGE',
    status: 'draft',
  });

  ContentRepository.setSections(draftPage.id, [
    {
      sectionType: 'hero',
      sortOrder: 1,
      data: { heading: 'Secret Draft Page', description: 'Under construction' },
      isVisible: true,
    },
  ]);

  // Anonymous request to draft page
  const anonResolved = ContentService.resolvePublicPage(testDraftPath, {
    isAdmin: false,
  });
  assert(anonResolved === null, 'Draft page is isolated from anonymous public requests (returns null / 404)');

  // Generate preview token
  const token = ContentService.createPreviewToken(draftPage.id);
  assert(typeof token === 'string' && token.length > 20, 'Preview token generated successfully');

  // Validate preview token
  const validTokenResolution = ContentService.resolvePublicPage(testDraftPath, {
    previewToken: token,
  });
  assert(validTokenResolution !== null, 'Valid preview token grants access to draft page');
  assert(validTokenResolution?.isPreview === true, 'Resolution context indicates isPreview = true');

  // Invalid preview token
  const invalidTokenResolution = ContentService.resolvePublicPage(testDraftPath, {
    previewToken: 'invalid_tampered_token_xyz',
  });
  assert(invalidTokenResolution === null, 'Invalid/tampered preview token rejects draft page access');

  // Admin access to draft
  const adminResolved = ContentService.resolvePublicPage(testDraftPath, {
    isAdmin: true,
  });
  assert(adminResolved !== null, 'Authenticated admin has access to view draft');

  // Publish page
  const publishedPage = ContentRepository.publishPage(draftPage.id);
  assert(publishedPage.status === 'published', 'Page successfully transitioned from draft to published');

  const pubResolved = ContentService.resolvePublicPage(testDraftPath, {
    isAdmin: false,
  });
  assert(pubResolved !== null, 'Published page is now accessible to anonymous public requests');

  // Clean up test page
  ContentRepository.deletePage(draftPage.id);
  assert(ContentRepository.getPageById(draftPage.id) === null, 'Test page cleaned up successfully');

  /* -------------------------------------------------------------------------
   * 5. SERVER-SIDE PUBLIC HTML INJECTION
   * ------------------------------------------------------------------------- */
  console.log('\n--- 5. Server-Side Public HTML Injection ---');

  const sampleHtml = `<!DOCTYPE html>
<html>
<head><title>Original</title></head>
<body>
  <div id="root">
    <main id="cms-main-content">
      <!-- SSR_FALLBACK -->
    </main>
  </div>
</body>
</html>`;

  const resolvedTiktok = ContentService.resolvePublicPage('/tiktok-video-downloader', {});
  assert(resolvedTiktok !== null, 'Resolved /tiktok-video-downloader public CMS page');

  if (resolvedTiktok) {
    const injectedHtml = ContentService.injectContentIntoHtml(
      sampleHtml,
      resolvedTiktok.page!,
      resolvedTiktok.sections!,
      Boolean(resolvedTiktok.isPreview)
    );
    assert(injectedHtml.includes('id="cms-main-content"'), 'Injected HTML contains cms-main-content target container');
    assert(injectedHtml.includes('__CMS_INITIAL_STATE__'), 'Injected HTML contains hydration payload __CMS_INITIAL_STATE__');
    assert(injectedHtml.toLowerCase().includes('tiktok'), 'Injected HTML contains tiktok content from CMS repository');
  }

  /* -------------------------------------------------------------------------
   * 6. SEPARATION OF CONCERNS WITH SEO CMS
   * ------------------------------------------------------------------------- */
  console.log('\n--- 6. Separation of Concerns (SEO CMS vs Pages CMS) ---');

  const seoRecord = SeoRepository.getPageByPath('/tiktok-video-downloader');
  const cmsRecord = ContentRepository.getPageByPath('/tiktok-video-downloader');

  assert(!!seoRecord, 'SEO CMS repository has /tiktok-video-downloader record');
  assert(!!cmsRecord, 'Pages CMS repository has /tiktok-video-downloader record');
  assert(seoRecord?.id !== cmsRecord?.id, 'SEO CMS and Pages CMS have separate independent IDs and entities');
  assert('metaTitle' in (seoRecord || {}), 'SEO record owns metadata (metaTitle, canonicalUrl, robots)');
  assert(!('metaTitle' in (cmsRecord || {})), 'Pages CMS record does not duplicate SEO metadata fields');
  assert(ContentRepository.getPageSections(cmsRecord!.id).length > 0, 'Pages CMS owns structured sections and blocks');

  /* -------------------------------------------------------------------------
   * FINAL SUMMARY
   * ------------------------------------------------------------------------- */
  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase83Verification().catch((err) => {
  console.error('Phase 8.3 verification threw unhandled exception:', err);
  process.exit(1);
});

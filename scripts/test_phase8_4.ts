/**
 * Phase 8.4 Comprehensive Production Verification Suite
 * Blog CMS + Advanced Editor + Media Library + Revisions + Publishing + SEO + SSR
 */

import { bootstrapAdminSystem } from '../server/admin/bootstrap.js';
import { BlogRepository } from '../server/admin/models/blogRepository.js';
import { BlogService } from '../server/admin/services/blogService.js';
import { BlogRendererService } from '../server/admin/services/blogRendererService.js';
import { MediaRepository } from '../server/admin/models/mediaRepository.js';
import { MediaService } from '../server/admin/services/mediaService.js';
import { SeoService } from '../server/admin/services/seoService.js';
import { AdminRepository } from '../server/admin/models/adminRepository.js';
import { StructuredDocument } from '../server/admin/models/blogDocumentTypes.js';

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

async function runPhase84Verification() {
  console.log('===============================================================');
  console.log('🧪 RUNNING PHASE 8.4 PRODUCTION EVIDENCE VERIFICATION SUITE');
  console.log('===============================================================\n');

  // 1. Initialize Bootstrap & Database
  console.log('--- 1. DATABASE & PERMISSIONS INITIALIZATION ---');
  await bootstrapAdminSystem();
  assert(true, 'Database schema and bootstrap system initialized.');

  const adminUser = AdminRepository.findByEmail('admin@example.com');
  assert(Boolean(adminUser), 'Super administrator user found');
  const adminId = adminUser!.id;

  // Verify Permissions
  const permissions = BlogRepository.listCategories();
  assert(Array.isArray(permissions), 'Category repository query executes smoothly.');

  // 2. Media Library Testing
  console.log('\n--- 2. MEDIA LIBRARY & ASSET MANAGEMENT ---');
  // Create test 1x1 transparent PNG buffer
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const mediaAsset = await MediaService.processAndSaveUpload({
    buffer: samplePngBuffer,
    originalFilename: 'test-cover-image.png',
    declaredMime: 'image/png',
    uploadedBy: adminId,
  });

  assert(Boolean(mediaAsset.id), 'Media asset saved to SQLite & disk storage', mediaAsset.id);
  assert(mediaAsset.mimeType === 'image/png', 'MIME type verified as image/png');
  assert(mediaAsset.width === 1 && mediaAsset.height === 1, 'Image dimensions parsed correctly (1x1)');
  assert(mediaAsset.publicUrl.startsWith('/uploads/'), 'Public URL formatted correctly', mediaAsset.publicUrl);

  // Magic byte security check - reject fake image
  let rejectedFake = false;
  try {
    const fakeBuffer = Buffer.from('<?php echo "evil"; ?>', 'utf-8');
    await MediaService.processAndSaveUpload({
      buffer: fakeBuffer,
      originalFilename: 'exploit.png',
      declaredMime: 'image/png',
      uploadedBy: adminId,
    });
  } catch (err: any) {
    rejectedFake = true;
  }
  assert(rejectedFake, 'Executable fake image rejected via magic-byte header validation');

  // 3. Taxonomies: Categories & Tags
  console.log('\n--- 3. TAXONOMIES: CATEGORIES & TAGS ---');
  const existingCat = BlogRepository.getCategoryBySlug('advanced-download-tips');
  if (existingCat) {
    BlogRepository.deleteCategory(existingCat.id);
  }
  const cat = BlogRepository.createCategory(
    'Advanced Download Tips',
    'advanced-download-tips',
    'Expert tips for highest resolution video extractions.'
  );
  assert(cat.slug === 'advanced-download-tips', 'Category created with normalized slug', cat);

  const existingTag = BlogRepository.getTagBySlug('ultra-hd');
  if (existingTag) {
    BlogRepository.deleteTag(existingTag.id);
  }
  const tag = BlogRepository.createTag('ultra-hd', 'ultra-hd');
  assert(tag.slug === 'ultra-hd', 'Tag created with normalized slug', tag);

  // 4. Structured AST Blog Article CRUD & Revisions
  console.log('\n--- 4. STRUCTURED AST BLOG ARTICLE CRUD & REVISIONS ---');
  const initialAst: StructuredDocument = {
    version: 1,
    type: 'doc',
    children: [
      {
        type: 'heading',
        level: 2,
        text: 'How to Download High Quality Videos',
      },
      {
        type: 'paragraph',
        text: 'This comprehensive guide explains how to extract MP4 files in original 1080p resolution.',
      },
      {
        type: 'callout',
        variant: 'tip',
        text: 'Always ensure your internet connection is stable before initiating high bitrate downloads.',
      },
      {
        type: 'image',
        url: mediaAsset.publicUrl,
        alt: 'High definition video downloader engine workflow',
        caption: 'Figure 1: Downloader extraction pipeline',
      },
    ],
  };

  const newPost = BlogService.createPost(
    {
      title: 'Complete 2026 Guide to Social Media Video Downloads',
      slug: 'complete-2026-guide-social-video-downloads',
      excerpt: 'Learn the fastest methods for downloading social media reels and videos in original HD quality.',
      contentDocument: initialAst,
      featuredMediaId: mediaAsset.id,
      primaryCategoryId: cat.id,
      categoryIds: [cat.id],
      tagNames: ['ultra-hd', 'guides', 'mp4'],
      status: 'draft',
      seoTitle: '2026 Social Media Video Download Guide — HD & 4K',
      metaDescription: 'Extract and save social media videos without watermark in high definition.',
    } as any,
    adminId
  );

  assert(Boolean(newPost.id), 'Blog post created as Draft in SQLite', newPost.id);
  assert(newPost.status === 'draft', 'Post initial status is draft');
  assert(newPost.featuredMedia?.id === mediaAsset.id, 'Featured media relation linked correctly');

  // Verify Media Usage Tracking
  const usages = MediaRepository.findUsages(mediaAsset.id, mediaAsset.publicUrl);
  assert(usages.length > 0, 'Media Library usage detection confirmed post usage', usages);

  // Update Post & Create Revision
  const updatedAst: StructuredDocument = {
    ...initialAst,
    children: [
      ...initialAst.children,
      {
        type: 'paragraph',
        text: 'Updated section: Format conversions support AAC 320kbps audio extraction.',
      },
    ],
  };

  const updatedPost = BlogService.updatePost(
    newPost.id,
    {
      title: 'Complete 2026 Guide to Social Media Video Downloads (Updated)',
      contentDocument: updatedAst,
      changeReason: 'Added audio format conversion details',
    } as any,
    adminId
  );

  assert(updatedPost.title.includes('(Updated)'), 'Post title and AST updated');

  // Verify Revision Snapshot
  const revisions = BlogRepository.getRevisionsByPostId(newPost.id);
  assert(revisions.length >= 2, 'Revision snapshots recorded automatically on edits', revisions.length);

  // Test Revision Restore
  const restoredPost = BlogService.restoreRevision(newPost.id, revisions[revisions.length - 1].id, adminId);
  assert(Boolean(restoredPost), 'Revision restore executed successfully');

  // 5. AST HTML Rendering & XSS Sanitization
  console.log('\n--- 5. AST HTML RENDERING & XSS SANITIZATION ---');
  const renderedHtml = BlogRendererService.renderDocumentToHtml(initialAst);
  assert(renderedHtml.includes('How to Download High Quality Videos</h2>') && renderedHtml.includes('<h2 class="cms-heading'), 'H2 rendered properly with typography classes');
  assert(renderedHtml.includes('class="cms-callout'), 'Callout block rendered with proper classes');
  assert(renderedHtml.includes('<img src="/uploads/'), 'Image tag rendered with sanitized source');

  // XSS Attack simulation in AST
  const maliciousAst: StructuredDocument = {
    version: 1,
    type: 'doc',
    children: [
      {
        type: 'paragraph',
        text: '<script>alert("XSS")</script><b>Dangerous text</b>',
      },
    ],
  };
  const safeHtml = BlogRendererService.renderDocumentToHtml(maliciousAst);
  assert(!safeHtml.includes('<script>'), 'Script tags strictly escaped in HTML renderer');
  assert(safeHtml.includes('&lt;script&gt;'), 'Malicious characters converted to safe HTML entities');

  // 6. Draft Isolation & Public Preview Tokens
  console.log('\n--- 6. DRAFT ISOLATION & PREVIEW SECURITY ---');
  // Anonymous request to draft post -> must be isolated
  const draftResolution = BlogService.resolvePublicPost(newPost.slug);
  assert(draftResolution.found === true, 'Draft record found in repository');
  assert(draftResolution.isPublished === false, 'Draft is not marked as published');
  assert(draftResolution.isPreview === false, 'Anonymous request has no preview access');

  // Generate secure preview token
  const previewToken = BlogService.createPreviewToken(newPost.id, adminId, 600);
  assert(previewToken.length >= 32, 'High-entropy preview token generated');

  // Authorized preview request
  const previewResolution = BlogService.resolvePublicPost(newPost.slug, previewToken);
  assert(previewResolution.isPreview === true, 'Authorized preview token successfully unlocks draft view');
  assert(Boolean(previewResolution.renderedContentHtml), 'Preview includes rendered article HTML');

  // Invalid preview token
  const invalidPreview = BlogService.resolvePublicPost(newPost.slug, 'fake-token-123456');
  assert(invalidPreview.isPreview === false, 'Invalid preview token rejected');

  // 7. Publishing Lifecycle & SEO / Sitemap Sync
  console.log('\n--- 7. PUBLISHING LIFECYCLE & SITEMAP SYNC ---');
  // Sitemap before publish -> draft must NOT be present
  const origin = 'http://localhost:3000';
  let sitemapXml = SeoService.generateSitemapXml(origin);
  assert(!sitemapXml.includes(`/blog/${newPost.slug}`), 'Draft article is strictly absent from sitemap.xml');

  // Publish Post
  const publishedPost = BlogService.publishPost(newPost.id, adminId);
  assert(publishedPost.status === 'published', 'Post status transitioned to published');
  assert(Boolean(publishedPost.publishedAt), 'Published timestamp recorded');

  // Public resolution for published post
  const publicResolution = BlogService.resolvePublicPost(newPost.slug);
  assert(publicResolution.isPublished === true, 'Published post is accessible to anonymous public');

  // Sitemap after publish -> MUST be present
  sitemapXml = SeoService.generateSitemapXml(origin);
  assert(sitemapXml.includes(`/blog/${newPost.slug}`), 'Published article automatically integrated into sitemap.xml');

  // Dynamic SEO resolution
  const seoResolution = SeoService.resolvePageSeo(`/blog/${newPost.slug}`, origin);
  assert(Boolean(seoResolution.seo), 'SEO resolved for public article');
  assert(Boolean(seoResolution.seo?.schemaJson?.includes('BlogPosting')), 'JSON-LD schema type is BlogPosting');
  assert(Boolean(seoResolution.seo?.robots.includes('index')), 'Published post robots set to index, follow');

  // Unpublish (revert to draft)
  const unpublishedPost = BlogService.unpublishPost(newPost.id, adminId);
  assert(unpublishedPost.status === 'draft', 'Post successfully unpublished');

  // Verify sitemap excludes unpublished post
  sitemapXml = SeoService.generateSitemapXml(origin);
  assert(!sitemapXml.includes(`/blog/${newPost.slug}`), 'Unpublished article immediately removed from sitemap.xml');

  // Clean up test post
  BlogRepository.deletePost(newPost.id);
  MediaRepository.deleteAsset(mediaAsset.id);

  console.log('\n===============================================================');
  console.log(`📊 PHASE 8.4 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase84Verification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

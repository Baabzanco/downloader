import { SeoRepository } from '../models/seoRepository.js';
import { ContentRepository } from '../models/contentRepository.js';
import { BlogRepository } from '../models/blogRepository.js';
import {
  SeoPage,
  SeoRedirect,
  PublicPageSeo,
  SeoBreadcrumbItem,
  SeoFaqItem,
  SeoPageHealthReport,
  SeoHealthCheckIssue,
} from '../models/seoTypes.js';

export interface ResolveSeoResult {
  seo?: PublicPageSeo;
  redirect?: {
    destination: string;
    statusCode: number;
  };
}

// Fallback registry for default public pages
export const DEFAULT_PUBLIC_ROUTES: Record<string, Partial<SeoPage>> = {
  '/': {
    path: '/',
    pageType: 'TOOL_PAGE',
    title: 'Universal Social Media Downloader - TikTok, IG, FB, YT, X & Pinterest',
    metaTitle: 'Universal Social Media Video Downloader Online HD MP4',
    metaDescription: 'Production-grade social media media resolver and downloader engine for TikTok, Instagram Reels, Facebook, YouTube Shorts, X/Twitter, and Pinterest.',
    h1: 'Universal Media Downloader Engine',
    ogTitle: 'Universal Social Media Video Downloader',
    ogDescription: 'Download high-definition videos from TikTok, Instagram, Facebook, YouTube Shorts, X, and Pinterest directly in MP4 format.',
    schemaType: 'SoftwareApplication',
    sitemapPriority: 1.0,
    sitemapChangeFrequency: 'daily',
    sitemapIncluded: true,
    robotsIndex: true,
    robotsFollow: true,
  },
  '/tiktok-video-downloader': {
    path: '/tiktok-video-downloader',
    pageType: 'TOOL_PAGE',
    title: 'TikTok Video Downloader - No Watermark MP4 HD',
    metaTitle: 'Download TikTok Videos Without Watermark HD MP4',
    metaDescription: 'Download TikTok videos without watermark in HD MP4 quality. Fast, free, direct streaming with clean audio tracks.',
    h1: 'TikTok Video Downloader',
    ogTitle: 'TikTok Video Downloader — No Watermark HD',
    ogDescription: 'Save TikTok videos directly without watermark in full MP4 HD quality.',
    schemaType: 'WebApplication',
    sitemapPriority: 0.9,
    sitemapChangeFrequency: 'weekly',
    sitemapIncluded: true,
    robotsIndex: true,
    robotsFollow: true,
  },
  '/instagram-reels-downloader': {
    path: '/instagram-reels-downloader',
    pageType: 'TOOL_PAGE',
    title: 'Instagram Reels Downloader - Download IG Reels & Videos HD MP4',
    metaTitle: 'Instagram Reels & Video Downloader Free HD MP4',
    metaDescription: 'Free online Instagram Reels Downloader. Download public Instagram Reels and videos in high definition MP4 format with audio.',
    h1: 'Instagram Reels Downloader',
    ogTitle: 'Instagram Reels & Video Downloader',
    ogDescription: 'Download public Instagram Reels and videos in crystal clear HD with full audio fidelity.',
    schemaType: 'WebApplication',
    sitemapPriority: 0.9,
    sitemapChangeFrequency: 'weekly',
    sitemapIncluded: true,
    robotsIndex: true,
    robotsFollow: true,
  },
  '/facebook-video-downloader': {
    path: '/facebook-video-downloader',
    pageType: 'TOOL_PAGE',
    title: 'Facebook Video Downloader - Reels & Watch HD',
    metaTitle: 'Facebook Video Downloader HD Reels & Watch MP4',
    metaDescription: 'Download Facebook Reels and public Watch videos in high quality MP4 format. Free, safe, and direct streaming.',
    h1: 'Facebook Video Downloader',
    ogTitle: 'Facebook Video Downloader HD MP4',
    ogDescription: 'Save public Facebook Reels and Watch videos directly in HD resolution.',
    schemaType: 'WebApplication',
    sitemapPriority: 0.9,
    sitemapChangeFrequency: 'weekly',
    sitemapIncluded: true,
    robotsIndex: true,
    robotsFollow: true,
  },
  '/youtube-shorts-downloader': {
    path: '/youtube-shorts-downloader',
    pageType: 'TOOL_PAGE',
    title: 'YouTube Shorts Downloader - HD Video & Audio',
    metaTitle: 'YouTube Shorts Downloader HD MP4 & MP3',
    metaDescription: 'Download YouTube Shorts and videos in full 1080p/720p HD MP4 and MP3 audio with direct streaming.',
    h1: 'YouTube Shorts Downloader',
    ogTitle: 'YouTube Shorts Video Downloader',
    ogDescription: 'Download YouTube Shorts and video clips with high-quality MP4 and audio options.',
    schemaType: 'WebApplication',
    sitemapPriority: 0.9,
    sitemapChangeFrequency: 'weekly',
    sitemapIncluded: true,
    robotsIndex: true,
    robotsFollow: true,
  },
  '/twitter-video-downloader': {
    path: '/twitter-video-downloader',
    pageType: 'TOOL_PAGE',
    title: 'X / Twitter Video Downloader - HD MP4',
    metaTitle: 'X / Twitter Video Downloader Download Tweets MP4',
    metaDescription: 'Download videos and animated GIFs from X (Twitter) in multiple MP4 resolutions with direct stream links.',
    h1: 'X / Twitter Video Downloader',
    ogTitle: 'X (Twitter) Video Downloader HD',
    ogDescription: 'Save videos and animated GIFs from public tweets and posts on X / Twitter in HD.',
    schemaType: 'WebApplication',
    sitemapPriority: 0.9,
    sitemapChangeFrequency: 'weekly',
    sitemapIncluded: true,
    robotsIndex: true,
    robotsFollow: true,
  },
  '/pinterest-video-downloader': {
    path: '/pinterest-video-downloader',
    pageType: 'TOOL_PAGE',
    title: 'Pinterest Video Downloader - Download Pinterest MP4 Videos Online',
    metaTitle: 'Pinterest Video Downloader Download Pins MP4 HD',
    metaDescription: 'Free online Pinterest Video Downloader. Download high quality Pinterest MP4 videos and Idea Pins in HD without registration.',
    h1: 'Pinterest Video Downloader',
    ogTitle: 'Pinterest Video Downloader HD MP4',
    ogDescription: 'Extract and download high-definition MP4 videos from Pinterest Pins and Idea Pins directly.',
    schemaType: 'WebApplication',
    sitemapPriority: 0.9,
    sitemapChangeFrequency: 'weekly',
    sitemapIncluded: true,
    robotsIndex: true,
    robotsFollow: true,
  },
  '/blog': {
    path: '/blog',
    pageType: 'STATIC_PAGE',
    title: 'Video Downloader Blog — Tutorials, Formats & Creator Resources',
    metaTitle: 'Video Downloader Blog — Tutorials, Formats & Creator Resources',
    metaDescription: 'Explore the latest guides, format comparisons, and creator tips for downloading social media videos in HD.',
    h1: 'Official Downloader Blog & Resources',
    ogTitle: 'Video Downloader Blog & Guides',
    ogDescription: 'Explore tutorials and creator guides for downloading high definition videos from social platforms.',
    schemaType: 'CollectionPage',
    sitemapPriority: 0.8,
    sitemapChangeFrequency: 'daily',
    sitemapIncluded: true,
    robotsIndex: true,
    robotsFollow: true,
  },
};

// URL and JSON escaping helpers
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function escapeJsonForScript(jsonStr: string): string {
  return jsonStr
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function normalizePath(rawPath: string): string {
  if (!rawPath) return '/';
  const clean = rawPath.split('?')[0].split('#')[0].trim();
  if (clean === '' || clean === '/') return '/';
  // Remove duplicate slashes and trailing slash
  const normalized = clean.replace(/\/+/g, '/');
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

export function sanitizeUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  // Allow root-relative paths like /og-image.png or valid http/https URLs
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.toString();
    } catch {
      return undefined;
    }
  }
  // Disallow javascript:, data:, or malformed protocols
  return undefined;
}

export class SeoService {
  /**
   * Determine the canonical public origin
   */
  static getPublicOrigin(reqOrigin?: string): string {
    const configured = SeoRepository.getSetting('public_site_url');
    if (configured && configured.trim()) {
      return configured.trim().replace(/\/+$/, '');
    }
    if (process.env.APP_URL && process.env.APP_URL.trim()) {
      return process.env.APP_URL.trim().replace(/\/+$/, '');
    }
    if (reqOrigin && reqOrigin.trim()) {
      return reqOrigin.trim().replace(/\/+$/, '');
    }
    return 'https://media-downloader.app';
  }

  /**
   * Resolve complete SEO for a requested path
   */
  static resolvePageSeo(rawPath: string, reqOrigin?: string): ResolveSeoResult {
    const path = normalizePath(rawPath);

    // 1. Check for active redirects
    const redirect = SeoRepository.getRedirectBySource(path);
    if (redirect && redirect.enabled) {
      // Prevent self-redirect loop
      if (redirect.destinationPath !== path) {
        return {
          redirect: {
            destination: redirect.destinationPath,
            statusCode: redirect.statusCode,
          },
        };
      }
    }

    // 2. Fetch page from database
    let page = SeoRepository.getPageByPath(path);

    // 2b. Dynamic Blog Routes Resolution
    if (!page) {
      if (path.startsWith('/blog/category/')) {
        const catSlug = path.replace('/blog/category/', '').trim();
        const category = BlogRepository.getCategoryBySlug(catSlug);
        if (category) {
          page = {
            id: `blog_cat_${category.id}`,
            path,
            pageType: 'BLOG_CATEGORY',
            title: `${category.name} Articles — Video Downloader Blog`,
            metaTitle: `${category.name} Articles — Video Downloader Blog`,
            metaDescription: category.description || `Read guides and tutorials in the ${category.name} category.`,
            canonicalUrl: null,
            robotsIndex: true,
            robotsFollow: true,
            robotsExtra: null,
            h1: `${category.name} Articles`,
            ogTitle: `${category.name} Articles — Video Downloader Blog`,
            ogDescription: category.description || `Read guides and tutorials in the ${category.name} category.`,
            ogImage: null,
            ogType: 'website',
            twitterCard: 'summary_large_image',
            twitterTitle: `${category.name} Articles — Video Downloader Blog`,
            twitterDescription: category.description || `Read guides and tutorials in the ${category.name} category.`,
            twitterImage: null,
            schemaType: 'CollectionPage',
            schemaJson: null,
            sitemapIncluded: true,
            sitemapPriority: 0.7,
            sitemapChangeFrequency: 'weekly',
            breadcrumbsJson: JSON.stringify([
              { label: 'Home', path: '/' },
              { label: 'Blog', path: '/blog' },
              { label: category.name, path },
            ]),
            faqJson: null,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
          };
        }
      } else if (path.startsWith('/blog/tag/')) {
        const tagSlug = path.replace('/blog/tag/', '').trim();
        const tag = BlogRepository.getTagBySlug(tagSlug);
        if (tag) {
          page = {
            id: `blog_tag_${tag.id}`,
            path,
            pageType: 'BLOG_TAG',
            title: `#${tag.name} Tagged Articles — Video Downloader Blog`,
            metaTitle: `#${tag.name} Tagged Articles — Video Downloader Blog`,
            metaDescription: `Read all articles and guides tagged with #${tag.name}.`,
            canonicalUrl: null,
            robotsIndex: true,
            robotsFollow: true,
            robotsExtra: null,
            h1: `#${tag.name} Articles`,
            ogTitle: `#${tag.name} Articles — Video Downloader Blog`,
            ogDescription: `Read all articles and guides tagged with #${tag.name}.`,
            ogImage: null,
            ogType: 'website',
            twitterCard: 'summary_large_image',
            twitterTitle: `#${tag.name} Articles — Video Downloader Blog`,
            twitterDescription: `Read all articles and guides tagged with #${tag.name}.`,
            twitterImage: null,
            schemaType: 'CollectionPage',
            schemaJson: null,
            sitemapIncluded: true,
            sitemapPriority: 0.6,
            sitemapChangeFrequency: 'weekly',
            breadcrumbsJson: JSON.stringify([
              { label: 'Home', path: '/' },
              { label: 'Blog', path: '/blog' },
              { label: `#${tag.name}`, path },
            ]),
            faqJson: null,
            createdAt: tag.createdAt,
            updatedAt: tag.updatedAt,
          };
        }
      } else if (path.startsWith('/blog/')) {
        const postSlug = path.replace('/blog/', '').trim();
        const post = BlogRepository.getPostWithRelations(postSlug);
        if (post) {
          const isPublished = post.status === 'published';
          page = {
            id: `blog_post_${post.id}`,
            path,
            pageType: 'BLOG_POST',
            title: `${post.title} — Video Downloader Blog`,
            metaTitle: `${post.title} — Video Downloader Blog`,
            metaDescription: post.excerpt || `Read ${post.title} on our official video downloader blog.`,
            canonicalUrl: null,
            robotsIndex: isPublished,
            robotsFollow: true,
            robotsExtra: isPublished ? 'max-image-preview:large' : 'noindex, nofollow',
            h1: post.title,
            ogTitle: post.title,
            ogDescription: post.excerpt || post.title,
            ogImage: post.featuredMedia?.publicUrl || null,
            ogType: 'article',
            twitterCard: 'summary_large_image',
            twitterTitle: post.title,
            twitterDescription: post.excerpt || post.title,
            twitterImage: post.featuredMedia?.publicUrl || null,
            schemaType: 'BlogPosting',
            schemaJson: null,
            sitemapIncluded: isPublished,
            sitemapPriority: 0.8,
            sitemapChangeFrequency: 'weekly',
            breadcrumbsJson: JSON.stringify([
              { label: 'Home', path: '/' },
              { label: 'Blog', path: '/blog' },
              { label: post.title, path },
            ]),
            faqJson: null,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
          };
        }
      }
    }

    // 3. Fallback to default route registry if not yet saved in database
    if (!page) {
      const defaultPage = DEFAULT_PUBLIC_ROUTES[path];
      if (defaultPage) {
        page = {
          id: `default_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          path,
          pageType: defaultPage.pageType || 'TOOL_PAGE',
          title: defaultPage.title || 'Media Downloader Engine',
          metaTitle: defaultPage.metaTitle || defaultPage.title,
          metaDescription: defaultPage.metaDescription || '',
          canonicalUrl: null,
          robotsIndex: defaultPage.robotsIndex !== false,
          robotsFollow: defaultPage.robotsFollow !== false,
          robotsExtra: 'max-image-preview:large',
          h1: defaultPage.h1 || defaultPage.title,
          ogTitle: defaultPage.ogTitle || defaultPage.title,
          ogDescription: defaultPage.ogDescription || defaultPage.metaDescription,
          ogImage: null,
          ogType: 'website',
          twitterCard: 'summary_large_image',
          twitterTitle: defaultPage.ogTitle || defaultPage.title,
          twitterDescription: defaultPage.ogDescription || defaultPage.metaDescription,
          twitterImage: null,
          schemaType: defaultPage.schemaType || 'WebPage',
          schemaJson: null,
          sitemapIncluded: defaultPage.sitemapIncluded !== false,
          sitemapPriority: defaultPage.sitemapPriority ?? 0.8,
          sitemapChangeFrequency: defaultPage.sitemapChangeFrequency || 'weekly',
          breadcrumbsJson: null,
          faqJson: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Universal fallback for dynamic or unknown path
        page = {
          id: `fallback_${Date.now()}`,
          path,
          pageType: 'STATIC_PAGE',
          title: 'Media Downloader Engine',
          metaTitle: 'Media Downloader Engine',
          metaDescription: 'Universal multi-platform public media resolution and streaming download engine.',
          canonicalUrl: null,
          robotsIndex: false, // Unknown path default to noindex for safety
          robotsFollow: true,
          robotsExtra: null,
          h1: 'Media Downloader Engine',
          ogTitle: 'Media Downloader Engine',
          ogDescription: 'Universal multi-platform public media resolution and streaming download engine.',
          ogImage: null,
          ogType: 'website',
          twitterCard: 'summary_large_image',
          twitterTitle: 'Media Downloader Engine',
          twitterDescription: 'Universal multi-platform public media resolution and streaming download engine.',
          twitterImage: null,
          schemaType: 'WebPage',
          schemaJson: null,
          sitemapIncluded: false,
          sitemapPriority: 0.5,
          sitemapChangeFrequency: 'weekly',
          breadcrumbsJson: null,
          faqJson: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }

    const publicOrigin = this.getPublicOrigin(reqOrigin);

    // Compute canonical URL
    let canonicalUrl: string;
    if (page.canonicalUrl && page.canonicalUrl.trim()) {
      const sanitized = sanitizeUrl(page.canonicalUrl);
      if (sanitized && sanitized.startsWith('http')) {
        canonicalUrl = sanitized;
      } else if (sanitized && sanitized.startsWith('/')) {
        canonicalUrl = `${publicOrigin}${sanitized}`;
      } else {
        canonicalUrl = `${publicOrigin}${page.path === '/' ? '/' : page.path}`;
      }
    } else {
      canonicalUrl = `${publicOrigin}${page.path === '/' ? '/' : page.path}`;
    }

    // Compute robots directive
    const robotsDirectives: string[] = [];
    robotsDirectives.push(page.robotsIndex ? 'index' : 'noindex');
    robotsDirectives.push(page.robotsFollow ? 'follow' : 'nofollow');
    if (page.robotsExtra && page.robotsExtra.trim()) {
      robotsDirectives.push(page.robotsExtra.trim());
    }
    const robots = robotsDirectives.join(', ');

    // Breadcrumbs
    let breadcrumbs: SeoBreadcrumbItem[] = [];
    if (page.breadcrumbsJson) {
      try {
        breadcrumbs = JSON.parse(page.breadcrumbsJson);
      } catch {}
    }
    if (breadcrumbs.length === 0) {
      if (page.path === '/') {
        breadcrumbs = [{ label: 'Home', path: '/' }];
      } else {
        breadcrumbs = [
          { label: 'Home', path: '/' },
          { label: page.h1 || page.title, path: page.path },
        ];
      }
    }

    // FAQs
    let faqs: SeoFaqItem[] = [];
    if (page.faqJson) {
      try {
        faqs = JSON.parse(page.faqJson);
      } catch {}
    }

    // Structured Data JSON-LD
    let schemaObj: any = null;
    if (page.schemaJson && page.schemaJson.trim()) {
      try {
        schemaObj = JSON.parse(page.schemaJson);
      } catch {}
    }

    if (!schemaObj) {
      // Build valid Schema.org structure
      if (page.schemaType === 'SoftwareApplication' || page.schemaType === 'WebApplication') {
        schemaObj = {
          '@context': 'https://schema.org',
          '@type': page.schemaType,
          name: page.h1 || page.title,
          url: canonicalUrl,
          description: page.metaDescription || page.title,
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'All',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
        };
      } else {
        schemaObj = {
          '@context': 'https://schema.org',
          '@type': page.schemaType || 'WebPage',
          name: page.h1 || page.title,
          url: canonicalUrl,
          description: page.metaDescription || page.title,
        };
      }

      // Append FAQPage schema if enabled FAQs exist
      const activeFaqs = faqs.filter((f) => f.enabled && f.question && f.answer);
      if (activeFaqs.length > 0) {
        schemaObj.mainEntity = {
          '@type': 'FAQPage',
          mainEntity: activeFaqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: f.answer,
            },
          })),
        };
      }

      // BreadcrumbList JSON-LD
      if (breadcrumbs.length > 1) {
        schemaObj.breadcrumb = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbs.map((b, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: b.label,
            item: b.path.startsWith('http') ? b.path : `${publicOrigin}${b.path}`,
          })),
        };
      }
    }

    const schemaJson = escapeJsonForScript(JSON.stringify(schemaObj));

    // Social and Open Graph
    const siteTitleSuffix = SeoRepository.getSetting('default_title_suffix') || ' — Media Downloader';
    const finalTitle = page.metaTitle || page.title;
    const finalOgTitle = page.ogTitle || finalTitle;
    const finalOgDesc = page.ogDescription || page.metaDescription || '';

    const ogImage = sanitizeUrl(page.ogImage) || sanitizeUrl(SeoRepository.getSetting('default_og_image'));
    const twitterImage = sanitizeUrl(page.twitterImage) || ogImage;

    return {
      seo: {
        path: page.path,
        title: finalTitle.includes('Downloader') ? finalTitle : `${finalTitle}${siteTitleSuffix}`,
        metaDescription: page.metaDescription || '',
        canonicalUrl,
        robots,
        h1: page.h1 || page.title,
        og: {
          title: finalOgTitle,
          description: finalOgDesc,
          url: canonicalUrl,
          type: page.ogType || 'website',
          image: ogImage ? (ogImage.startsWith('http') ? ogImage : `${publicOrigin}${ogImage}`) : undefined,
          siteName: 'Media Downloader Engine',
        },
        twitter: {
          card: page.twitterCard || 'summary_large_image',
          title: page.twitterTitle || finalOgTitle,
          description: page.twitterDescription || finalOgDesc,
          image: twitterImage ? (twitterImage.startsWith('http') ? twitterImage : `${publicOrigin}${twitterImage}`) : undefined,
        },
        schemaJson,
        breadcrumbs,
        faqs,
      },
    };
  }

  /**
   * Generates dynamic sitemap.xml
   */
  static generateSitemapXml(publicOrigin: string): string {
    const rawPages = SeoRepository.getSitemapPages();
    const existingPaths = new Set<string>();
    const pages: SeoPage[] = [];

    // Filter out pages that are CMS pages or Blog posts with draft/archived/scheduled status
    for (const p of rawPages) {
      try {
        const cmsPage = ContentRepository.getPageByPath(p.path);
        if (cmsPage && cmsPage.status !== 'published') {
          continue; // Draft or archived CMS pages must NOT be in sitemap
        }
      } catch {}

      try {
        if (p.path.startsWith('/blog/')) {
          const postSlug = p.path.replace('/blog/', '').trim();
          const blogPost = BlogRepository.getPostBySlug(postSlug);
          if (blogPost && blogPost.status !== 'published') {
            continue; // Draft, scheduled, or archived blog posts must NOT be in sitemap
          }
        }
      } catch {}

      pages.push(p);
      existingPaths.add(p.path);
    }

    // Include published CMS pages not already in sitemap
    try {
      const publishedCmsPages = ContentRepository.listPages({ status: 'published' });
      for (const cmsPage of publishedCmsPages) {
        if (!existingPaths.has(cmsPage.path)) {
          const seoRecord = SeoRepository.getPageByPath(cmsPage.path);
          if (seoRecord) {
            if (seoRecord.sitemapIncluded && seoRecord.robotsIndex) {
              pages.push(seoRecord);
              existingPaths.add(cmsPage.path);
            }
          } else {
            // Default published CMS page is sitemap included
            pages.push({
              id: cmsPage.id,
              path: cmsPage.path,
              pageType: (cmsPage.pageType as any) || 'TOOL_PAGE',
              title: cmsPage.title,
              metaTitle: cmsPage.title,
              metaDescription: null,
              canonicalUrl: null,
              robotsIndex: true,
              robotsFollow: true,
              robotsExtra: null,
              h1: null,
              ogTitle: null,
              ogDescription: null,
              ogImage: null,
              ogType: 'website',
              twitterCard: 'summary_large_image',
              twitterTitle: null,
              twitterDescription: null,
              twitterImage: null,
              schemaType: 'WebPage',
              schemaJson: null,
              sitemapIncluded: true,
              sitemapPriority: 0.7,
              sitemapChangeFrequency: 'weekly',
              breadcrumbsJson: null,
              faqJson: null,
              createdAt: cmsPage.createdAt,
              updatedAt: cmsPage.updatedAt,
            });
            existingPaths.add(cmsPage.path);
          }
        }
      }
    } catch {
      // ignore
    }

    // Include published Blog posts not already in sitemap
    try {
      const publishedBlogPosts = BlogRepository.listPosts({ status: 'published', limit: 100 }).posts;
      for (const post of publishedBlogPosts) {
        const postPath = `/blog/${post.slug}`;
        if (!existingPaths.has(postPath)) {
          const seoRecord = SeoRepository.getPageByPath(postPath);
          if (seoRecord) {
            if (seoRecord.sitemapIncluded && seoRecord.robotsIndex) {
              pages.push(seoRecord);
              existingPaths.add(postPath);
            }
          } else {
            pages.push({
              id: post.id,
              path: postPath,
              pageType: 'BLOG_POST',
              title: post.title,
              metaTitle: post.title,
              metaDescription: post.excerpt,
              canonicalUrl: null,
              robotsIndex: true,
              robotsFollow: true,
              robotsExtra: null,
              h1: post.title,
              ogTitle: post.title,
              ogDescription: post.excerpt,
              ogImage: post.featuredMedia?.publicUrl || null,
              ogType: 'article',
              twitterCard: 'summary_large_image',
              twitterTitle: post.title,
              twitterDescription: post.excerpt,
              twitterImage: post.featuredMedia?.publicUrl || null,
              schemaType: 'BlogPosting',
              schemaJson: null,
              sitemapIncluded: true,
              sitemapPriority: 0.8,
              sitemapChangeFrequency: 'weekly',
              breadcrumbsJson: null,
              faqJson: null,
              createdAt: post.createdAt,
              updatedAt: post.updatedAt,
            });
            existingPaths.add(postPath);
          }
        }
      }
    } catch {
      // ignore
    }

    const origin = publicOrigin.replace(/\/+$/, '');

    const urlsXml = pages
      .map((p) => {
        const loc = `${origin}${p.path === '/' ? '' : p.path}`;
        const lastmod = p.updatedAt ? p.updatedAt.split('T')[0] : new Date().toISOString().split('T')[0];
        const changefreq = p.sitemapChangeFrequency || 'weekly';
        const priority = (p.sitemapPriority ?? 0.8).toFixed(1);

        return `  <url>
    <loc>${escapeHtml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;
  }

  /**
   * Generates dynamic robots.txt
   */
  static generateRobotsTxt(publicOrigin: string): string {
    const origin = publicOrigin.replace(/\/+$/, '');
    const custom = SeoRepository.getSetting('robots_txt_custom');

    const base = [
      '# Robots.txt for Media Downloader Engine',
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /admin/*',
      'Disallow: /api/admin/',
      'Disallow: /api/media/diagnostics',
      'Allow: /api/media/download',
      'Allow: /api/media/resolve',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
    ];

    if (custom && custom.trim()) {
      base.push('', '# Custom Directives', custom.trim());
    }

    return base.join('\n') + '\n';
  }

  /**
   * Injects SEO head tags into raw index.html template
   */
  static injectSeoIntoHtml(html: string, seo: PublicPageSeo): string {
    // 1. Title replacement
    let modified = html.replace(/<title>.*?<\/title>/is, `<title>${escapeHtml(seo.title)}</title>`);

    // 2. Head injection bundle
    const tagsToInject: string[] = [
      `<!-- Dynamic SEO Tags -->`,
      `<meta name="description" content="${escapeHtml(seo.metaDescription)}" />`,
      `<link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />`,
      `<meta name="robots" content="${escapeHtml(seo.robots)}" />`,
      `<meta property="og:title" content="${escapeHtml(seo.og.title)}" />`,
      `<meta property="og:description" content="${escapeHtml(seo.og.description)}" />`,
      `<meta property="og:url" content="${escapeHtml(seo.og.url)}" />`,
      `<meta property="og:type" content="${escapeHtml(seo.og.type)}" />`,
      `<meta property="og:site_name" content="${escapeHtml(seo.og.siteName)}" />`,
    ];

    if (seo.og.image) {
      tagsToInject.push(`<meta property="og:image" content="${escapeHtml(seo.og.image)}" />`);
    }

    tagsToInject.push(
      `<meta name="twitter:card" content="${escapeHtml(seo.twitter.card)}" />`,
      `<meta name="twitter:title" content="${escapeHtml(seo.twitter.title)}" />`,
      `<meta name="twitter:description" content="${escapeHtml(seo.twitter.description)}" />`
    );

    if (seo.twitter.image) {
      tagsToInject.push(`<meta name="twitter:image" content="${escapeHtml(seo.twitter.image)}" />`);
    }

    if (seo.schemaJson) {
      // Disarm any </script> breakout tags by escaping the forward slash
      const disarmedJson = seo.schemaJson.replace(/<\/script/gi, '<\\/script');
      tagsToInject.push(
        `<script id="seo-structured-data" type="application/ld+json">${disarmedJson}</script>`
      );
    }

    const injectionString = tagsToInject.join('\n    ');

    // Remove any hardcoded placeholders from base template
    modified = modified
      .replace(/<meta\s+name=["']description["'][^>]*>/i, '')
      .replace(/<meta\s+property=["']og:title["'][^>]*>/i, '')
      .replace(/<meta\s+property=["']og:description["'][^>]*>/i, '')
      .replace(/<meta\s+property=["']og:type["'][^>]*>/i, '')
      .replace(/<meta\s+name=["']twitter:card["'][^>]*>/i, '');

    // Insert right before </head>
    return modified.replace('</head>', `    ${injectionString}\n  </head>`);
  }

  /**
   * Run comprehensive SEO Health Check
   */
  static runHealthAudit(): SeoPageHealthReport[] {
    const pages = SeoRepository.listPages();
    const reports: SeoPageHealthReport[] = [];

    for (const page of pages) {
      const issues: SeoHealthCheckIssue[] = [];
      const titleLen = page.title.length;
      const descLen = page.metaDescription?.length || 0;

      // Title checks
      if (!page.title || titleLen === 0) {
        issues.push({ severity: 'ERROR', field: 'title', message: 'SEO Title is missing or empty.' });
      } else if (titleLen < 25) {
        issues.push({ severity: 'WARNING', field: 'title', message: `Title is short (${titleLen} chars). Recommended: 30–65 chars.` });
      } else if (titleLen > 70) {
        issues.push({ severity: 'WARNING', field: 'title', message: `Title exceeds 70 chars (${titleLen} chars) and may truncate in SERPs.` });
      } else {
        issues.push({ severity: 'PASS', field: 'title', message: `Title length optimal (${titleLen} chars).` });
      }

      // Meta Description checks
      if (!page.metaDescription || descLen === 0) {
        issues.push({ severity: 'ERROR', field: 'metaDescription', message: 'Meta description is missing.' });
      } else if (descLen < 80) {
        issues.push({ severity: 'WARNING', field: 'metaDescription', message: `Meta description is short (${descLen} chars). Recommended: 120–160 chars.` });
      } else if (descLen > 180) {
        issues.push({ severity: 'WARNING', field: 'metaDescription', message: `Meta description exceeds 180 chars (${descLen} chars) and may truncate.` });
      } else {
        issues.push({ severity: 'PASS', field: 'metaDescription', message: `Meta description optimal (${descLen} chars).` });
      }

      // H1 check
      if (!page.h1 || page.h1.trim().length === 0) {
        issues.push({ severity: 'WARNING', field: 'h1', message: 'H1 header is not explicitly set.' });
      } else {
        issues.push({ severity: 'PASS', field: 'h1', message: `H1 header defined: "${page.h1}".` });
      }

      // Canonical check
      if (page.canonicalUrl && !/^https?:\/\//i.test(page.canonicalUrl) && !page.canonicalUrl.startsWith('/')) {
        issues.push({ severity: 'ERROR', field: 'canonicalUrl', message: 'Canonical URL is malformed or uses an unsafe scheme.' });
      } else {
        issues.push({ severity: 'PASS', field: 'canonicalUrl', message: 'Canonical URL well-formed.' });
      }

      // Robots check
      if (!page.robotsIndex) {
        issues.push({ severity: 'WARNING', field: 'robotsIndex', message: 'Page is marked noindex and will not be indexed by search engines.' });
      } else {
        issues.push({ severity: 'PASS', field: 'robotsIndex', message: 'Page is indexable.' });
      }

      // Social check
      if (!page.ogTitle && !page.metaTitle && !page.title) {
        issues.push({ severity: 'WARNING', field: 'ogTitle', message: 'Open Graph title missing.' });
      }

      // Schema check
      let hasValidSchema = true;
      if (page.schemaJson) {
        try {
          JSON.parse(page.schemaJson);
          issues.push({ severity: 'PASS', field: 'schemaJson', message: 'Custom Schema JSON-LD is valid.' });
        } catch {
          hasValidSchema = false;
          issues.push({ severity: 'ERROR', field: 'schemaJson', message: 'Custom Schema JSON is malformed JSON syntax.' });
        }
      }

      // Sitemap check
      if (!page.sitemapIncluded && page.robotsIndex) {
        issues.push({ severity: 'WARNING', field: 'sitemapIncluded', message: 'Page is indexable but excluded from sitemap.xml.' });
      }

      // Overall status
      let status: 'PASS' | 'WARNING' | 'ERROR' = 'PASS';
      if (issues.some((i) => i.severity === 'ERROR')) {
        status = 'ERROR';
      } else if (issues.some((i) => i.severity === 'WARNING')) {
        status = 'WARNING';
      }

      reports.push({
        pageId: page.id,
        path: page.path,
        title: page.title,
        status,
        scoreDetails: {
          titleLength: titleLen,
          descriptionLength: descLen,
          hasH1: Boolean(page.h1),
          hasCanonical: Boolean(page.canonicalUrl),
          isIndexable: page.robotsIndex,
          hasOgTags: Boolean(page.ogTitle || page.title),
          hasTwitterTags: Boolean(page.twitterTitle || page.title),
          hasValidSchema,
          inSitemap: page.sitemapIncluded,
        },
        issues,
      });
    }

    return reports;
  }
}

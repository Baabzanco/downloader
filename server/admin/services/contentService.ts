/**
 * Content Resolution & Safe Rendering Service for Phase 8.3 Pages CMS
 */

import { ContentRepository } from '../models/contentRepository.js';
import { ContentSeeder } from '../models/contentSeeder.js';
import {
  ContentPage,
  ContentPageSection,
  ContentPageWithSections,
  HeroSectionData,
  RichTextSectionData,
  FeatureGridSectionData,
  HowToSectionData,
  FaqSectionData,
  CtaSectionData,
  RelatedToolsSectionData,
} from '../models/contentTypes.js';
import {
  normalizeCmsPath,
  sanitizeHtmlString,
} from './contentValidationService.js';

export interface ResolvePageResult {
  found: boolean;
  isPublished?: boolean;
  isPreview?: boolean;
  status?: string;
  page?: ContentPage;
  sections?: ContentPageSection[];
}

export class ContentService {
  /**
   * Ensures default 7 core landing pages are seeded into SQLite
   */
  static ensureDefaultPagesSeeded(): void {
    ContentSeeder.seedDefaultPages();
  }

  /**
   * Generates a cryptographic preview token for draft viewing
   */
  static createPreviewToken(pageId: string, userId = 'system_admin'): string {
    const tokenRecord = ContentRepository.createPreviewToken(pageId, userId, 60); // 60 minutes
    return tokenRecord.token;
  }

  /**
   * Resolves a public CMS page, enforcing draft/archive isolation
   */
  static resolvePublicPage(
    path: string,
    options?: string | { previewToken?: string; isAdmin?: boolean }
  ): ResolvePageResult | null {
    let normalized: string;
    try {
      normalized = normalizeCmsPath(path);
    } catch {
      return null;
    }

    let previewToken: string | undefined;
    let isAdmin = false;

    if (typeof options === 'string') {
      previewToken = options;
    } else if (options && typeof options === 'object') {
      previewToken = options.previewToken;
      isAdmin = Boolean(options.isAdmin);
    }

    let page = ContentRepository.getPageByPath(normalized);
    if (!page) {
      // Auto-seed if it's one of the core routes
      const coreRoutes = [
        '/',
        '/tiktok-video-downloader',
        '/instagram-reels-downloader',
        '/facebook-video-downloader',
        '/youtube-shorts-downloader',
        '/twitter-video-downloader',
        '/pinterest-video-downloader',
      ];
      if (coreRoutes.includes(normalized)) {
        ContentSeeder.seedDefaultPages();
        page = ContentRepository.getPageByPath(normalized);
      }
    }

    if (!page) {
      return null;
    }

    // Check preview token authorization
    let isAuthorizedPreview = false;
    if (previewToken) {
      const verified = ContentRepository.verifyPreviewToken(previewToken);
      if (verified.valid && verified.pageId === page.id) {
        isAuthorizedPreview = true;
      }
    }

    if (page.status !== 'published') {
      if (isAuthorizedPreview || isAdmin) {
        const sections = ContentRepository.getPageSections(page.id, false);
        return {
          found: true,
          isPublished: false,
          isPreview: true,
          status: page.status,
          page,
          sections,
        };
      }

      // Draft / Archived isolation: do NOT expose content to public
      return null;
    }

    // Published page: load visible sections
    const sections = ContentRepository.getPageSections(page.id, true);
    return {
      found: true,
      isPublished: true,
      isPreview: false,
      status: page.status,
      page,
      sections,
    };
  }

  /**
   * Renders structured sections into safe, accessible server-rendered HTML
   */
  static renderSectionsHtml(sections: ContentPageSection[]): string {
    const renderedSections: string[] = [];

    for (const sec of sections) {
      if (!sec.isVisible) continue;

      switch (sec.sectionType) {
        case 'hero': {
          const data = sec.data as HeroSectionData;
          const alignClass = data.alignment === 'left' ? 'text-left' : 'text-center';
          renderedSections.push(`
            <section class="cms-hero py-8 ${alignClass} space-y-3" data-section-type="hero">
              ${data.eyebrow ? `<div class="cms-eyebrow text-xs font-semibold text-emerald-400 uppercase tracking-wider">${sanitizeHtmlString(data.eyebrow)}</div>` : ''}
              <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">${sanitizeHtmlString(data.heading)}</h1>
              <p class="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">${sanitizeHtmlString(data.description)}</p>
              ${data.primaryCta || data.secondaryCta ? `
                <div class="cms-hero-cta pt-4 flex flex-wrap items-center justify-center gap-3">
                  ${data.primaryCta ? `<a href="${sanitizeHtmlString(data.primaryCta.url)}" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-xs text-white transition-colors">${sanitizeHtmlString(data.primaryCta.label)}</a>` : ''}
                  ${data.secondaryCta ? `<a href="${sanitizeHtmlString(data.secondaryCta.url)}" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-medium text-xs text-slate-200 transition-colors">${sanitizeHtmlString(data.secondaryCta.label)}</a>` : ''}
                </div>
              ` : ''}
            </section>
          `);
          break;
        }

        case 'rich_text': {
          const data = sec.data as RichTextSectionData;
          renderedSections.push(`
            <section class="cms-rich-text bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4" data-section-type="rich_text">
              ${data.heading ? `<h2 class="text-xl font-bold text-white">${sanitizeHtmlString(data.heading)}</h2>` : ''}
              ${data.subheading ? `<h3 class="text-sm font-semibold text-slate-300">${sanitizeHtmlString(data.subheading)}</h3>` : ''}
              <div class="cms-content text-sm text-slate-300 leading-relaxed space-y-3">
                ${data.content.split('\n\n').map(p => `<p>${sanitizeHtmlString(p)}</p>`).join('')}
              </div>
            </section>
          `);
          break;
        }

        case 'feature_grid': {
          const data = sec.data as FeatureGridSectionData;
          renderedSections.push(`
            <section class="cms-feature-grid space-y-4 pt-4" data-section-type="feature_grid">
              <div class="text-center space-y-1">
                <h2 class="text-xl font-bold text-white">${sanitizeHtmlString(data.heading)}</h2>
                ${data.description ? `<p class="text-xs text-slate-400 max-w-xl mx-auto">${sanitizeHtmlString(data.description)}</p>` : ''}
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                ${data.features.map(f => `
                  <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                    <h3 class="font-semibold text-sm text-slate-200">${sanitizeHtmlString(f.title)}</h3>
                    <p class="text-xs text-slate-400 leading-relaxed">${sanitizeHtmlString(f.description)}</p>
                  </div>
                `).join('')}
              </div>
            </section>
          `);
          break;
        }

        case 'how_to': {
          const data = sec.data as HowToSectionData;
          renderedSections.push(`
            <section class="cms-how-to space-y-4 pt-4" data-section-type="how_to">
              <div class="text-center space-y-1">
                <h2 class="text-xl font-bold text-white">${sanitizeHtmlString(data.heading)}</h2>
                ${data.description ? `<p class="text-xs text-slate-400 max-w-xl mx-auto">${sanitizeHtmlString(data.description)}</p>` : ''}
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                ${data.steps.map(s => `
                  <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                    <div class="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-xs">
                      ${s.stepNumber}
                    </div>
                    <h3 class="font-semibold text-sm text-slate-200">${sanitizeHtmlString(s.title)}</h3>
                    <p class="text-xs text-slate-400">${sanitizeHtmlString(s.description)}</p>
                  </div>
                `).join('')}
              </div>
            </section>
          `);
          break;
        }

        case 'faq': {
          const data = sec.data as FaqSectionData;
          renderedSections.push(`
            <section class="cms-faq bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4" data-section-type="faq">
              <div class="space-y-1">
                <h2 class="text-xl font-bold text-white">${sanitizeHtmlString(data.heading || 'Frequently Asked Questions')}</h2>
                ${data.description ? `<p class="text-xs text-slate-400">${sanitizeHtmlString(data.description)}</p>` : ''}
              </div>
              <div class="space-y-3 pt-2">
                ${data.items.map(item => `
                  <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1.5">
                    <h3 class="font-semibold text-sm text-slate-200">${sanitizeHtmlString(item.question)}</h3>
                    <p class="text-xs text-slate-400 leading-relaxed">${sanitizeHtmlString(item.answer)}</p>
                  </div>
                `).join('')}
              </div>
            </section>
          `);
          break;
        }

        case 'cta': {
          const data = sec.data as CtaSectionData;
          renderedSections.push(`
            <section class="cms-cta bg-gradient-to-r from-indigo-950/60 to-slate-900/80 border border-indigo-500/20 rounded-2xl p-6 sm:p-8 text-center space-y-3" data-section-type="cta">
              <h2 class="text-xl font-bold text-white">${sanitizeHtmlString(data.heading)}</h2>
              <p class="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">${sanitizeHtmlString(data.description)}</p>
              <div class="pt-2">
                <a href="${sanitizeHtmlString(data.buttonUrl)}" class="inline-flex px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-xs text-white transition-colors shadow-lg shadow-indigo-500/20">
                  ${sanitizeHtmlString(data.buttonLabel)}
                </a>
              </div>
            </section>
          `);
          break;
        }

        case 'related_tools': {
          const data = sec.data as RelatedToolsSectionData;
          renderedSections.push(`
            <section class="cms-related-tools pt-4 border-t border-slate-800" data-section-type="related_tools">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">${sanitizeHtmlString(data.heading || 'Related Free Download Tools')}</h3>
              ${data.description ? `<p class="text-xs text-slate-400 mb-3">${sanitizeHtmlString(data.description)}</p>` : ''}
              <div class="flex flex-wrap gap-2">
                ${data.tools.map(tool => `
                  <a href="${sanitizeHtmlString(tool.route)}" class="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white flex items-center space-x-1 transition-colors">
                    <span>${sanitizeHtmlString(tool.label)}</span>
                    <span class="text-slate-500">→</span>
                  </a>
                `).join('')}
              </div>
            </section>
          `);
          break;
        }
      }
    }

    return renderedSections.join('\n');
  }

  /**
   * Injects rendered CMS sections and initial state into the server HTML template
   */
  static injectContentIntoHtml(
    html: string,
    pageOrResolution: ContentPage | ResolvePageResult,
    sectionsParam?: ContentPageSection[],
    isPreviewParam = false
  ): string {
    let page: ContentPage | undefined;
    let sections: ContentPageSection[];
    let isPreview = isPreviewParam;

    if ('page' in pageOrResolution && 'sections' in pageOrResolution) {
      page = pageOrResolution.page;
      sections = pageOrResolution.sections || [];
      isPreview = pageOrResolution.isPreview ?? false;
    } else {
      page = pageOrResolution as ContentPage;
      sections = sectionsParam || [];
    }

    if (!page) return html;

    const renderedBody = this.renderSectionsHtml(sections || []);

    const previewBanner = isPreview
      ? `<div id="cms-preview-banner" class="bg-amber-500 text-slate-950 text-xs font-bold text-center py-1.5 px-4 sticky top-0 z-50 shadow-md">
          PREVIEW MODE — Viewing unpublished draft content for "${sanitizeHtmlString(page.title)}"
        </div>`
      : '';

    const contentWrapper = `
      ${previewBanner}
      <div id="cms-rendered-content" class="max-w-5xl mx-auto px-4 py-6 space-y-6">
        ${renderedBody}
      </div>
    `;

    // Inject state into a safe script tag so client-side React can hydrate immediately
    const safeState = JSON.stringify({
      page,
      sections,
      isPreview,
    }).replace(/<\/script/gi, '<\\/script');

    const stateScript = `<script id="__CMS_INITIAL_STATE__" type="application/json">${safeState}</script>`;

    // If root element exists, inject initial content inside or right before closing body
    let modified = html;
    if (modified.includes('</body>')) {
      modified = modified.replace('</body>', `  ${stateScript}\n</body>`);
    }

    // Insert rendered content container for crawlers & raw HTML inspection
    if (modified.includes('<main id="cms-main-content">')) {
      modified = modified.replace(
        /<main id="cms-main-content">[\s\S]*?<\/main>/,
        `<main id="cms-main-content"><div id="cms-prerendered-content">${contentWrapper}</div></main>`
      );
    } else if (modified.includes('<div id="root"></div>')) {
      modified = modified.replace(
        '<div id="root"></div>',
        `<div id="root"><main id="cms-main-content"><div id="cms-prerendered-content">${contentWrapper}</div></main></div>`
      );
    } else if (modified.includes('<div id="root">')) {
      modified = modified.replace(
        '<div id="root">',
        `<div id="root"><main id="cms-main-content"><div id="cms-prerendered-content">${contentWrapper}</div></main>`
      );
    }

    return modified;
  }
}

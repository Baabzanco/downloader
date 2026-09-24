/**
 * Content Validation & Sanitization Service for Phase 8.3 Pages CMS
 */

import {
  SectionType,
  HeroSectionData,
  RichTextSectionData,
  FeatureGridSectionData,
  HowToSectionData,
  FaqSectionData,
  CtaSectionData,
  RelatedToolsSectionData,
} from '../models/contentTypes.js';

export const RESERVED_PATH_PREFIXES = [
  '/admin',
  '/api',
  '/sitemap.xml',
  '/robots.txt',
  '/favicon.ico',
  '/assets',
  '/dist',
  '/public',
];

export const ALLOWED_INTERNAL_DOWNLOADER_ROUTES = [
  '/',
  '/tiktok-video-downloader',
  '/instagram-reels-downloader',
  '/facebook-video-downloader',
  '/youtube-shorts-downloader',
  '/twitter-video-downloader',
  '/pinterest-video-downloader',
];

export class ContentValidationError extends Error {
  public code: string;
  public details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'ContentValidationError';
    this.code = code;
    this.details = details;
  }
}

export function normalizeCmsPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') {
    throw new ContentValidationError('INVALID_PATH', 'Path must be a non-empty string.');
  }

  let cleaned = rawPath.trim();
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }

  // Remove trailing slashes (except root)
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.replace(/\/+$/, '');
  }

  // Replace duplicate slashes
  cleaned = cleaned.replace(/\/+/g, '/').toLowerCase();

  // Traversal & control character protection
  if (cleaned.includes('..') || cleaned.includes('\\') || /[\x00-\x1F\x7F]/.test(cleaned)) {
    throw new ContentValidationError('PATH_TRAVERSAL_DETECTED', 'Path contains illegal traversal characters.');
  }

  // Character validation
  if (!/^\/[a-z0-9\-_\/]*$/.test(cleaned)) {
    throw new ContentValidationError(
      'INVALID_PATH_CHARACTERS',
      'Path may only contain lowercase alphanumeric characters, hyphens, underscores, and forward slashes.'
    );
  }

  return cleaned;
}

export function validatePathSecurity(normalizedPath: string): void {
  // Check reserved path collisions
  for (const reserved of RESERVED_PATH_PREFIXES) {
    if (normalizedPath === reserved || normalizedPath.startsWith(`${reserved}/`)) {
      throw new ContentValidationError(
        'RESERVED_PATH_COLLISION',
        `The path "${normalizedPath}" conflicts with reserved system route "${reserved}".`
      );
    }
  }
}

export function sanitizeUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  // Reject dangerous schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    throw new ContentValidationError(
      'DANGEROUS_URL_SCHEME',
      'Dangerous URI scheme (javascript:, data:, vbscript:) rejected.'
    );
  }

  // Allow relative paths starting with /
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Allow safe in-page anchor links (e.g. #downloader)
  if (trimmed.startsWith('#')) {
    if (!/^#[a-zA-Z0-9\-_]+$/.test(trimmed)) {
      throw new ContentValidationError(
        'INVALID_URL_FORMAT',
        'Anchor link must contain valid alphanumeric characters.'
      );
    }
    return trimmed;
  }

  // Allow http/https
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return trimmed;
  }

  throw new ContentValidationError(
    'INVALID_URL_FORMAT',
    'URL must be an absolute http/https address or a relative path starting with "/".'
  );
}

export function stripUnsafeHtml(str?: string | null): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<\/?(?:iframe|object|embed|applet|meta|link)\b[^>]*>/gi, '');
}

export function sanitizeHtmlString(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function validateSectionData(sectionType: SectionType, data: any): any {
  if (!data || typeof data !== 'object') {
    throw new ContentValidationError('INVALID_SECTION_DATA', 'Section data must be an object.');
  }

  switch (sectionType) {
    case 'hero': {
      const hero = data as HeroSectionData;
      const heading = stripUnsafeHtml(hero.heading);
      if (!heading || !heading.trim()) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Hero section requires a non-empty heading.');
      }
      if (heading.length > 250) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Hero heading cannot exceed 250 characters.');
      }
      const description = stripUnsafeHtml(hero.description);
      if (!description) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Hero section requires a description.');
      }
      if (description.length > 2000) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Hero description cannot exceed 2000 characters.');
      }
      const cleanHero: HeroSectionData = {
        ...hero,
        eyebrow: hero.eyebrow ? stripUnsafeHtml(hero.eyebrow) : undefined,
        heading,
        description,
        alignment: hero.alignment || 'center',
      };
      if (hero.primaryCta) {
        if (!hero.primaryCta.label || !hero.primaryCta.url) {
          throw new ContentValidationError('VALIDATION_ERROR', 'Primary CTA requires both label and url.');
        }
        cleanHero.primaryCta = {
          label: stripUnsafeHtml(hero.primaryCta.label),
          url: sanitizeUrl(hero.primaryCta.url)!,
        };
      }
      if (hero.secondaryCta) {
        if (!hero.secondaryCta.label || !hero.secondaryCta.url) {
          throw new ContentValidationError('VALIDATION_ERROR', 'Secondary CTA requires both label and url.');
        }
        cleanHero.secondaryCta = {
          label: stripUnsafeHtml(hero.secondaryCta.label),
          url: sanitizeUrl(hero.secondaryCta.url)!,
        };
      }
      if (hero.imageUrl) {
        cleanHero.imageUrl = sanitizeUrl(hero.imageUrl) || undefined;
      }
      return cleanHero;
    }

    case 'rich_text': {
      const rt = data as RichTextSectionData;
      const content = stripUnsafeHtml(rt.content);
      if (!content || !content.trim()) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Rich text section requires non-empty content.');
      }
      if (content.length > 50000) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Rich text content cannot exceed 50,000 characters.');
      }
      return { content };
    }

    case 'feature_grid': {
      const fg = data as FeatureGridSectionData;
      const heading = stripUnsafeHtml(fg.heading);
      if (!heading || !heading.trim()) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Feature grid requires a non-empty heading.');
      }
      if (!Array.isArray(fg.features) || fg.features.length === 0) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Feature grid must contain at least 1 feature.');
      }
      if (fg.features.length > 24) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Feature grid cannot exceed 24 features.');
      }
      const features = fg.features.map((feat) => {
        const title = stripUnsafeHtml(feat.title);
        const description = stripUnsafeHtml(feat.description);
        if (!title || !title.trim()) {
          throw new ContentValidationError('VALIDATION_ERROR', 'Each feature must have a non-empty title.');
        }
        if (!description || !description.trim()) {
          throw new ContentValidationError('VALIDATION_ERROR', 'Each feature must have a non-empty description.');
        }
        return {
          icon: feat.icon ? stripUnsafeHtml(feat.icon) : undefined,
          title,
          description,
        };
      });
      return {
        heading,
        description: fg.description ? stripUnsafeHtml(fg.description) : undefined,
        features,
      };
    }

    case 'how_to': {
      const ht = data as HowToSectionData;
      const heading = stripUnsafeHtml(ht.heading);
      if (!heading || !heading.trim()) {
        throw new ContentValidationError('VALIDATION_ERROR', 'How-To section requires a heading.');
      }
      if (!Array.isArray(ht.steps) || ht.steps.length === 0) {
        throw new ContentValidationError('VALIDATION_ERROR', 'How-To section must contain at least 1 step.');
      }
      if (ht.steps.length > 12) {
        throw new ContentValidationError('VALIDATION_ERROR', 'How-To section cannot exceed 12 steps.');
      }
      const steps = ht.steps.map((step, idx) => {
        const title = stripUnsafeHtml(step.title);
        const description = stripUnsafeHtml(step.description);
        if (!title || !title.trim()) {
          throw new ContentValidationError('VALIDATION_ERROR', 'Each How-To step must have a title.');
        }
        if (!description || !description.trim()) {
          throw new ContentValidationError('VALIDATION_ERROR', 'Each How-To step must have a description.');
        }
        return {
          stepNumber: typeof step.stepNumber === 'number' ? step.stepNumber : idx + 1,
          title,
          description,
          imageUrl: step.imageUrl ? sanitizeUrl(step.imageUrl) || undefined : undefined,
        };
      });
      return {
        heading,
        description: ht.description ? stripUnsafeHtml(ht.description) : undefined,
        steps,
      };
    }

    case 'faq': {
      const faq = data as FaqSectionData;
      if (!Array.isArray(faq.items) || faq.items.length === 0) {
        throw new ContentValidationError('VALIDATION_ERROR', 'FAQ section must contain at least 1 question.');
      }
      if (faq.items.length > 50) {
        throw new ContentValidationError('VALIDATION_ERROR', 'FAQ section cannot exceed 50 items.');
      }
      const items = faq.items.map((item) => {
        const question = stripUnsafeHtml(item.question);
        const answer = stripUnsafeHtml(item.answer);
        if (!question || !question.trim()) {
          throw new ContentValidationError('VALIDATION_ERROR', 'FAQ question cannot be empty.');
        }
        if (!answer || !answer.trim()) {
          throw new ContentValidationError('VALIDATION_ERROR', 'FAQ answer cannot be empty.');
        }
        return { question, answer };
      });
      return {
        heading: faq.heading ? stripUnsafeHtml(faq.heading) : undefined,
        description: faq.description ? stripUnsafeHtml(faq.description) : undefined,
        items,
      };
    }

    case 'cta': {
      const cta = data as CtaSectionData;
      const heading = stripUnsafeHtml(cta.heading);
      if (!heading || !heading.trim()) {
        throw new ContentValidationError('VALIDATION_ERROR', 'CTA section requires a heading.');
      }
      const buttonLabel = stripUnsafeHtml(cta.buttonLabel);
      if (!buttonLabel || !buttonLabel.trim()) {
        throw new ContentValidationError('VALIDATION_ERROR', 'CTA section requires a button label.');
      }
      if (!cta.buttonUrl || !cta.buttonUrl.trim()) {
        throw new ContentValidationError('VALIDATION_ERROR', 'CTA section requires a button URL.');
      }
      const buttonUrl = sanitizeUrl(cta.buttonUrl);
      return {
        heading,
        description: cta.description ? stripUnsafeHtml(cta.description) : undefined,
        buttonLabel,
        buttonUrl: buttonUrl!,
      };
    }

    case 'related_tools': {
      const rt = data as RelatedToolsSectionData;
      const heading = stripUnsafeHtml(rt.heading);
      if (!heading || !heading.trim()) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Related tools section requires a heading.');
      }
      if (!Array.isArray(rt.tools) || rt.tools.length === 0) {
        throw new ContentValidationError('VALIDATION_ERROR', 'Related tools section must contain at least 1 tool.');
      }
      const tools = rt.tools.map((tool) => {
        if (!tool.route || !tool.route.trim()) {
          throw new ContentValidationError('VALIDATION_ERROR', 'Related tool route cannot be empty.');
        }
        if (!ALLOWED_INTERNAL_DOWNLOADER_ROUTES.includes(tool.route)) {
          throw new ContentValidationError(
            'INVALID_RELATED_TOOL_ROUTE',
            `Tool route "${tool.route}" is not an allowed internal downloader route.`
          );
        }
        const label = stripUnsafeHtml(tool.label);
        if (!label || !label.trim()) {
          throw new ContentValidationError('VALIDATION_ERROR', 'Related tool label cannot be empty.');
        }
        return { route: tool.route, label };
      });
      return {
        heading,
        description: rt.description ? stripUnsafeHtml(rt.description) : undefined,
        tools,
      };
    }

    default:
      throw new ContentValidationError('INVALID_SECTION_TYPE', `Unknown section type "${sectionType}".`);
  }
}

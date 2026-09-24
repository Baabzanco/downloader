/**
 * Content Types for Phase 8.3 Pages / Landing CMS
 */

export type ContentPageStatus = 'draft' | 'published' | 'archived';
export type ContentPageType = 'STATIC_PAGE' | 'TOOL_PAGE' | 'LANDING_PAGE';

export type SectionType =
  | 'hero'
  | 'rich_text'
  | 'feature_grid'
  | 'how_to'
  | 'faq'
  | 'cta'
  | 'related_tools';

export interface ContentPage {
  id: string;
  path: string;
  pageType: ContentPageType;
  title: string;
  slug: string;
  status: ContentPageStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ContentPageSection<T = any> {
  id: string;
  pageId: string;
  sectionType: SectionType;
  sortOrder: number;
  data: T;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentPageWithSections extends ContentPage {
  sections: ContentPageSection[];
}

export interface ContentPreviewToken {
  token: string;
  pageId: string;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
}

/* ==========================================================================
 * Section Specific Structured Data Schemas
 * ========================================================================== */

export interface HeroSectionData {
  eyebrow?: string;
  heading: string;
  description: string;
  primaryCta?: {
    label: string;
    url: string;
  };
  secondaryCta?: {
    label: string;
    url: string;
  };
  imageUrl?: string;
  alignment?: 'left' | 'center';
}

export interface RichTextSectionData {
  heading?: string;
  subheading?: string;
  content: string; // Markdown or sanitized HTML paragraphs
}

export interface FeatureItem {
  title: string;
  description: string;
  icon?: string;
}

export interface FeatureGridSectionData {
  heading: string;
  description?: string;
  features: FeatureItem[];
}

export interface HowToStep {
  stepNumber: number;
  title: string;
  description: string;
  imageUrl?: string;
}

export interface HowToSectionData {
  heading: string;
  description?: string;
  steps: HowToStep[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSectionData {
  heading?: string;
  description?: string;
  items: FaqItem[];
}

export interface CtaSectionData {
  heading: string;
  description: string;
  buttonLabel: string;
  buttonUrl: string;
}

export interface RelatedToolItem {
  route: string;
  label: string;
  description?: string;
}

export interface RelatedToolsSectionData {
  heading: string;
  description?: string;
  tools: RelatedToolItem[];
}

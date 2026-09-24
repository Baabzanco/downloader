export type SeoPageType =
  | 'STATIC_PAGE'
  | 'TOOL_PAGE'
  | 'BLOG_POST'
  | 'BLOG_CATEGORY'
  | 'BLOG_TAG';

export type SitemapChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface SeoFaqItem {
  question: string;
  answer: string;
  order: number;
  enabled: boolean;
}

export interface SeoBreadcrumbItem {
  label: string;
  path: string;
}

export interface SeoPage {
  id: string;
  path: string;
  pageType: SeoPageType;
  title: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  robotsExtra?: string | null;
  h1?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  ogType: string;
  twitterCard: string;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  schemaType: string;
  schemaJson?: string | null;
  sitemapIncluded: boolean;
  sitemapPriority: number;
  sitemapChangeFrequency: SitemapChangeFreq;
  breadcrumbsJson?: string | null;
  faqJson?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeoRedirect {
  id: string;
  sourcePath: string;
  destinationPath: string;
  statusCode: 301 | 302 | 307 | 308;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SeoSetting {
  key: string;
  value: string;
  description?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface PublicPageSeo {
  path: string;
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  robots: string;
  h1: string;
  og: {
    title: string;
    description: string;
    url: string;
    type: string;
    image?: string;
    siteName: string;
  };
  twitter: {
    card: string;
    title: string;
    description: string;
    image?: string;
  };
  schemaJson: string;
  breadcrumbs: SeoBreadcrumbItem[];
  faqs: SeoFaqItem[];
}

export interface SeoHealthCheckIssue {
  severity: 'ERROR' | 'WARNING' | 'PASS';
  field: string;
  message: string;
}

export interface SeoPageHealthReport {
  pageId: string;
  path: string;
  title: string;
  status: 'PASS' | 'WARNING' | 'ERROR';
  scoreDetails: {
    titleLength: number;
    descriptionLength: number;
    hasH1: boolean;
    hasCanonical: boolean;
    isIndexable: boolean;
    hasOgTags: boolean;
    hasTwitterTags: boolean;
    hasValidSchema: boolean;
    inSitemap: boolean;
  };
  issues: SeoHealthCheckIssue[];
}

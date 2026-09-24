export interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  permissionCount?: number;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  key: string;
  description?: string | null;
  category: string;
  createdAt: string;
}

export interface AdminUserPublic {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
  roles: Role[];
  permissions: string[];
}

export interface AuditLog {
  id: string;
  actorAdminUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AdminSetting {
  key: string;
  value: string;
  description?: string | null;
  isSecret: boolean;
  category: string;
  updatedAt: string;
  updatedBy?: string | null;
}

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


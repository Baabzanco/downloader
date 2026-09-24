/**
 * Blog CMS Types & Interfaces for Phase 8.4
 */

import { StructuredDocument } from './blogDocumentTypes.js';
import { MediaAsset } from './mediaTypes.js';

export type BlogPostStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  postCount?: number;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  postCount?: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentDocument: StructuredDocument;
  featuredMediaId: string | null;
  authorId: string | null;
  primaryCategoryId: string | null;
  status: BlogPostStatus;
  publishAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface BlogPostWithRelations extends BlogPost {
  featuredMedia?: MediaAsset | null;
  authorName?: string | null;
  primaryCategory?: BlogCategory | null;
  categories: BlogCategory[];
  tags: BlogTag[];
  readTimeMinutes?: number;
}

export interface BlogPostCreateInput {
  title: string;
  slug?: string;
  excerpt?: string | null;
  contentDocument: StructuredDocument;
  featuredMediaId?: string | null;
  authorId?: string | null;
  primaryCategoryId?: string | null;
  categoryIds?: string[];
  tagIds?: string[];
  status?: BlogPostStatus;
  publishAt?: string | null;
  createdBy?: string | null;
  // SEO overrides
  seoTitle?: string;
  metaDescription?: string;
}

export interface BlogPostUpdateInput {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  contentDocument?: StructuredDocument;
  featuredMediaId?: string | null;
  authorId?: string | null;
  primaryCategoryId?: string | null;
  categoryIds?: string[];
  tagIds?: string[];
  status?: BlogPostStatus;
  publishAt?: string | null;
  updatedBy?: string | null;
  // SEO overrides
  seoTitle?: string;
  metaDescription?: string;
}

export interface BlogRevision {
  id: string;
  postId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  contentDocument: StructuredDocument;
  featuredMediaId: string | null;
  primaryCategoryId: string | null;
  categoryIds: string[];
  tagIds: string[];
  authorId: string | null;
  status: BlogPostStatus;
  createdBy: string | null;
  createdByName?: string | null;
  createdAt: string;
  restoreNote: string | null;
}

export interface BlogListFilter {
  status?: BlogPostStatus | 'all';
  categoryId?: string;
  categorySlug?: string;
  tagId?: string;
  tagSlug?: string;
  authorId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

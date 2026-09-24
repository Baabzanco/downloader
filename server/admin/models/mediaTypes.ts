/**
 * Media Library Types & Models for Phase 8.4
 */

export type MediaType = 'image' | 'video' | 'audio' | 'document';

export interface MediaAsset {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  mediaType: MediaType;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  storageKey: string;
  publicUrl: string;
  altText: string | null;
  caption: string | null;
  title: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAssetCreateInput {
  filename: string;
  originalFilename: string;
  mimeType: string;
  mediaType?: MediaType;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  storageKey: string;
  publicUrl: string;
  altText?: string | null;
  caption?: string | null;
  title?: string | null;
  uploadedBy?: string | null;
}

export interface MediaAssetUpdateInput {
  altText?: string | null;
  caption?: string | null;
  title?: string | null;
}

export interface MediaListFilter {
  search?: string;
  mediaType?: MediaType;
  mimeType?: string;
  limit?: number;
  offset?: number;
}

export interface MediaUsageReference {
  type: 'post_featured' | 'post_content' | 'seo_og' | 'content_section';
  id: string;
  title: string;
  pathOrSlug: string;
}

export type PlatformId =
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'twitter'
  | 'pinterest'
  | 'unknown';

export type MediaType = 'video' | 'image' | 'audio';

export interface MediaVariant {
  id: string;
  url: string;
  format: string; // e.g. 'mp4', 'mp3'
  mimeType: string;
  width?: number;
  height?: number;
  bitrate?: number;
  fileSize?: number; // in bytes
  quality?: string; // e.g. 'HD (No Watermark)', 'Watermarked', 'Original Audio'
  hasWatermark?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  videoCodec?: string;
  audioCodec?: string;
}

export interface MediaAuthor {
  id?: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  verified?: boolean;
}

export interface MediaStats {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  downloads?: number;
}

export interface ResolvedMedia {
  id: string;
  platform: PlatformId;
  sourceUrl: string;
  normalizedUrl: string;
  title?: string;
  author?: MediaAuthor;
  thumbnailUrl?: string;
  duration?: number; // duration in seconds
  mediaType: MediaType;
  variants: MediaVariant[];
  stats?: MediaStats;
  resolvedAt: string;
}

export type DownloaderErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PLATFORM'
  | 'PRIVATE_MEDIA'
  | 'MEDIA_NOT_FOUND'
  | 'RESOLUTION_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'FILE_TOO_LARGE'
  | 'UPSTREAM_ERROR'
  | 'SSRF_ATTEMPT'
  | 'INTERNAL_ERROR';

export interface DownloaderErrorResponse {
  success: false;
  error: {
    code: DownloaderErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface DownloaderSuccessResponse {
  success: true;
  media: ResolvedMedia;
  downloadToken?: string;
}

export type ResolveApiResponse = DownloaderSuccessResponse | DownloaderErrorResponse;

export interface DiagnosticLogEntry {
  id: string;
  timestamp: string;
  action: 'detect' | 'resolve' | 'download';
  platform?: PlatformId;
  url?: string;
  status: 'started' | 'success' | 'failed';
  details?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

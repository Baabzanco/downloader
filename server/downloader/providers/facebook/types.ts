export interface SnapSaveTokenPayload {
  url?: string;
  filename?: string;
  headers?: Record<string, string>;
  iat?: number;
  exp?: number;
  nbf?: number;
  tag?: string;
  bitrate?: number;
}

export interface ExtractedFacebookVariant {
  id: string;
  quality: string;
  url: string;
  format: string;
  mimeType: string;
  bitrate?: number;
  hasAudio: boolean;
}

export interface FacebookResolvedData {
  id: string;
  title: string;
  author?: {
    name: string;
    username?: string;
  };
  thumbnailUrl?: string;
  duration?: number;
  variants: ExtractedFacebookVariant[];
}

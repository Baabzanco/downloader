export interface LoaderToInitResponse {
  success: boolean;
  id?: string;
  url?: string | null;
  progress_url?: string;
  text?: string;
  title?: string | null;
  info?: {
    title?: string | null;
    image?: string;
  };
  format?: string;
  full_format?: string;
  thumbnail_url?: string;
  message?: string;
}

export interface LoaderToProgressResponse {
  success: number;
  progress: number;
  download_url?: string;
  text?: string;
  message?: string;
  format?: string;
}

export interface YouTubeOEmbedResponse {
  title?: string;
  author_name?: string;
  author_url?: string;
  type?: string;
  height?: number;
  width?: number;
  version?: string;
  provider_name?: string;
  provider_url?: string;
  thumbnail_height?: number;
  thumbnail_width?: number;
  thumbnail_url?: string;
  html?: string;
}

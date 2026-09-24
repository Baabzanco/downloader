export interface PinterestVideoItem {
  url?: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
  captions_urls?: Record<string, string>;
}

export interface PinterestVideoList {
  V_720P?: PinterestVideoItem;
  V_EXP7?: PinterestVideoItem;
  V_EXP6?: PinterestVideoItem;
  V_EXP5?: PinterestVideoItem;
  V_EXP4?: PinterestVideoItem;
  V_EXP3?: PinterestVideoItem;
  V_EXP2?: PinterestVideoItem;
  V_EXP1?: PinterestVideoItem;
  V_HLSV4?: PinterestVideoItem;
  V_HLSV3_MOBILE?: PinterestVideoItem;
  [key: string]: PinterestVideoItem | undefined;
}

export interface PinterestPinData {
  id: string;
  title?: string;
  grid_title?: string;
  description?: string;
  videos?: {
    id?: string;
    video_list?: PinterestVideoList;
  } | null;
  story_pin_data?: {
    pages?: Array<{
      blocks?: Array<{
        type?: string;
        video?: {
          video_list?: PinterestVideoList;
        };
      }>;
    }>;
  } | null;
  images?: Record<string, { url?: string; width?: number; height?: number }>;
  pinner?: {
    id?: string;
    username?: string;
    full_name?: string;
    image_large_url?: string;
  };
  repin_count?: number;
  comment_count?: number;
  reaction_counts?: Record<string, number>;
  created_at?: string;
}

export interface PinterestResourceResponse {
  resource_response?: {
    status?: string;
    http_status?: number;
    code?: number;
    message?: string;
    data?: PinterestPinData | null;
    error?: {
      message?: string;
      http_status?: number;
    };
  };
}

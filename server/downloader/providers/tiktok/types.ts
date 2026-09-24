export interface TikWMResponse {
  code: number;
  msg: string;
  processed_time?: number;
  data?: {
    id: string;
    region?: string;
    title?: string;
    cover?: string;
    ai_dynamic_cover?: string;
    origin_cover?: string;
    duration?: number;
    play?: string; // Video without watermark
    wmplay?: string; // Video with watermark
    hdplay?: string; // HD video if available
    size?: number;
    wm_size?: number;
    hd_size?: number;
    music?: string;
    music_info?: {
      id?: string;
      title?: string;
      play?: string;
      author?: string;
      duration?: number;
      cover?: string;
    };
    play_count?: number;
    digg_count?: number;
    comment_count?: number;
    share_count?: number;
    download_count?: number;
    author?: {
      id?: string;
      unique_id?: string;
      nickname?: string;
      avatar?: string;
    };
    images?: string[]; // If slideshow/image post
  };
}

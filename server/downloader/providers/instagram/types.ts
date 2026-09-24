export interface SnapVideoAjaxResponse {
  status: 'ok' | 'error';
  mess?: string;
  data?: string;
  p?: string;
  v?: string;
}

export interface SnapVideoTokenPayload {
  url: string;
  filename?: string;
  nbf?: number;
  exp?: number;
  iat?: number;
}

export interface ExtractedInstagramMediaItem {
  directUrl: string;
  proxyUrl?: string;
  filename: string;
  type: 'video' | 'photo';
  resolution?: string;
}

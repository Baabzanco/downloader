import { MediaProvider } from '../BaseProvider.js';
import {
  PlatformId,
  ResolvedMedia,
  MediaVariant,
  MediaType,
} from '../../core/types.js';
import { DownloaderAppError } from '../../core/errors.js';
import { SnapVideoAjaxResponse, SnapVideoTokenPayload } from './types.js';

interface CachedResolution {
  media: ResolvedMedia;
  cachedAt: number;
}

interface SnapVideoSessionConfig {
  exp: string;
  token: string;
  obtainedAt: number;
}

export class InstagramProvider implements MediaProvider {
  public readonly platform: PlatformId = 'instagram';
  public readonly name = 'Instagram Provider';
  public readonly isEnabled = true;

  // Single-flight in-flight request deduplication map
  private inFlightRequests: Map<string, Promise<ResolvedMedia>> = new Map();
  // Short-lived resolution cache (5 minutes TTL) to reduce redundant upstream load
  private resolutionCache: Map<string, CachedResolution> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  // Session config cache (15 minutes TTL)
  private sessionConfig: SnapVideoSessionConfig | null = null;
  private readonly SESSION_CONFIG_TTL_MS = 15 * 60 * 1000;

  // Mutex queue to pace outgoing upstream requests respecting rate limits
  private lastUpstreamCallTime = 0;
  private readonly MIN_UPSTREAM_INTERVAL_MS = 1500; // 1.5s between upstream calls

  private getTimeoutMs(): number {
    const val = Number(process.env.INSTAGRAM_PROVIDER_TIMEOUT_MS);
    return !isNaN(val) && val > 0 ? val : 15000;
  }

  public canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const isInstagramHost =
      host === 'instagram.com' ||
      host.endsWith('.instagram.com') ||
      host === 'instagr.am';

    if (!isInstagramHost) return false;

    // Check for supported paths: /p/, /reel/, /reels/, /tv/
    const pathname = url.pathname;
    return (
      /\/p\/[^/]+/i.test(pathname) ||
      /\/reel\/[^/]+/i.test(pathname) ||
      /\/reels\/[^/]+/i.test(pathname) ||
      /\/tv\/[^/]+/i.test(pathname)
    );
  }

  public async resolve(url: URL): Promise<ResolvedMedia> {
    const targetUrl = url.toString();

    // 1. Check short-lived cache
    const cached = this.resolutionCache.get(targetUrl);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.media;
    }

    // 2. Request coalescing: if identical URL is currently resolving, join existing promise
    const inFlight = this.inFlightRequests.get(targetUrl);
    if (inFlight) {
      return inFlight;
    }

    const resolutionPromise = this.executeResolutionWithPacing(url);
    this.inFlightRequests.set(targetUrl, resolutionPromise);

    try {
      const result = await resolutionPromise;
      this.resolutionCache.set(targetUrl, {
        media: result,
        cachedAt: Date.now(),
      });
      return result;
    } finally {
      this.inFlightRequests.delete(targetUrl);
    }
  }

  /**
   * Fetches or reuses cached session tokens (k_exp, k_token) required by SnapVideo
   */
  private async getSessionConfig(): Promise<{ exp: string; token: string }> {
    const now = Date.now();
    if (
      this.sessionConfig &&
      now - this.sessionConfig.obtainedAt < this.SESSION_CONFIG_TTL_MS
    ) {
      return { exp: this.sessionConfig.exp, token: this.sessionConfig.token };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('https://snapvideo.app/en', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const expMatch = html.match(/k_exp="([^"]+)"/);
        const tokenMatch = html.match(/k_token="([^"]+)"/);
        if (expMatch && tokenMatch) {
          this.sessionConfig = {
            exp: expMatch[1],
            token: tokenMatch[1],
            obtainedAt: now,
          };
          return { exp: expMatch[1], token: tokenMatch[1] };
        }
      }
    } catch {
      // If fetching homepage token fails, fallback to empty tokens (service may still process)
    }

    return { exp: '', token: '' };
  }

  /**
   * Paced upstream execution with retries on rate-limit
   */
  private async executeResolutionWithPacing(url: URL): Promise<ResolvedMedia> {
    const targetUrl = url.toString();
    const maxRetries = 3;
    let attempt = 0;

    // Extract shortcode from path (e.g. /reel/CY9Kk-xo0vs/ -> CY9Kk-xo0vs)
    const shortcodeMatch = url.pathname.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    const shortcode = shortcodeMatch ? shortcodeMatch[1] : '';

    while (attempt < maxRetries) {
      attempt++;

      // Enforce rate spacing
      const now = Date.now();
      const timeSinceLast = now - this.lastUpstreamCallTime;
      if (timeSinceLast < this.MIN_UPSTREAM_INTERVAL_MS) {
        const waitMs = this.MIN_UPSTREAM_INTERVAL_MS - timeSinceLast;
        await new Promise((r) => setTimeout(r, waitMs));
      }
      this.lastUpstreamCallTime = Date.now();

      const config = await this.getSessionConfig();

      const controller = new AbortController();
      const timeoutMs = this.getTimeoutMs();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch('https://snapvideo.app/api/ajaxSearch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Accept: 'application/json, text/javascript, */*; q=0.01',
            Origin: 'https://snapvideo.app',
            Referer: 'https://snapvideo.app/en',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: new URLSearchParams({
            k_exp: config.exp,
            k_token: config.token,
            q: targetUrl,
            t: 'media',
            lang: 'en',
            v: 'v2',
          }).toString(),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new DownloaderAppError(
            'TIMEOUT',
            `Instagram media resolution timed out after ${timeoutMs}ms while contacting upstream provider.`,
            504
          );
        }
        throw new DownloaderAppError(
          'UPSTREAM_ERROR',
          `Network error contacting Instagram resolver: ${err instanceof Error ? err.message : String(err)}`,
          502
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (res.status === 429) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        throw new DownloaderAppError(
          'RATE_LIMITED',
          'Instagram resolver rate limit reached. Please wait a moment before trying again.',
          429
        );
      }

      if (!res.ok) {
        throw new DownloaderAppError(
          'UPSTREAM_ERROR',
          `Instagram resolver returned HTTP status ${res.status}.`,
          res.status >= 500 ? 502 : 400
        );
      }

      let payload: SnapVideoAjaxResponse;
      try {
        payload = (await res.json()) as SnapVideoAjaxResponse;
      } catch {
        throw new DownloaderAppError(
          'RESOLUTION_FAILED',
          'Failed to parse Instagram resolver response format as JSON.',
          502
        );
      }

      if (!payload || typeof payload !== 'object') {
        throw new DownloaderAppError(
          'RESOLUTION_FAILED',
          'Instagram resolver returned an empty or invalid payload.',
          502
        );
      }

      const msg = (payload.mess || '').toLowerCase();

      // Check for rate-limiting or Cloudflare challenge in mess
      if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('try again later')) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        throw new DownloaderAppError(
          'RATE_LIMITED',
          'Instagram resolver rate limit reached. Please wait a moment before trying again.',
          429
        );
      }

      // Check for private media
      if (msg.includes('private') || msg.includes('private video') || msg.includes('private account')) {
        throw new DownloaderAppError(
          'PRIVATE_MEDIA',
          'This Instagram media is from a private account or requires authentication to access.',
          403
        );
      }

      // Check for non-existent / deleted media
      if (
        msg.includes('not found') ||
        msg.includes('deleted') ||
        msg.includes('does not exist') ||
        msg.includes('wrong link') ||
        msg.includes('invalid')
      ) {
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'The requested Instagram post or reel could not be found or has been removed.',
          404
        );
      }

      if (!payload.data || typeof payload.data !== 'string') {
        if (msg) {
          throw new DownloaderAppError('RESOLUTION_FAILED', payload.mess || 'Unable to resolve Instagram media.', 400);
        }
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'No media was returned by Instagram resolver for this URL.',
          404
        );
      }

      return this.mapDataToResolvedMedia(payload.data, targetUrl, shortcode);
    }

    throw new DownloaderAppError(
      'RATE_LIMITED',
      'Exceeded retry attempts contacting Instagram resolver.',
      429
    );
  }

  /**
   * Parses the HTML snippet returned by SnapVideo to extract media items and JWT tokens
   */
  private mapDataToResolvedMedia(
    html: string,
    targetUrl: string,
    shortcode: string
  ): ResolvedMedia {
    // Extract tokens from links and options:
    // token=(eyJhbGci...)
    const tokenRegex = /[?&]token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;
    const tokens = [...html.matchAll(tokenRegex)].map((m) => m[1]);

    const decodedPayloads: SnapVideoTokenPayload[] = [];
    const seenUrls = new Set<string>();

    for (const token of tokens) {
      try {
        const parts = token.split('.');
        if (parts.length < 2) continue;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '==='.slice((base64.length + 3) % 4);
        const payload = JSON.parse(
          Buffer.from(padded, 'base64').toString('utf-8')
        ) as SnapVideoTokenPayload;

        if (payload && payload.url && !seenUrls.has(payload.url)) {
          seenUrls.add(payload.url);
          decodedPayloads.push(payload);
        }
      } catch {
        // Skip unparseable tokens
      }
    }

    if (decodedPayloads.length === 0) {
      // Check if the response contains specific error cues
      const lower = html.toLowerCase();
      if (lower.includes('private')) {
        throw new DownloaderAppError(
          'PRIVATE_MEDIA',
          'This Instagram media is from a private account or requires authentication to access.',
          403
        );
      }
      if (lower.includes('not found') || lower.includes('deleted')) {
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'The requested Instagram post or reel could not be found or has been removed.',
          404
        );
      }

      throw new DownloaderAppError(
        'RESOLUTION_FAILED',
        'Could not extract downloadable media streams from Instagram response.',
        404
      );
    }

    // Separate video streams and photo streams
    const videoPayloads: SnapVideoTokenPayload[] = [];
    const photoPayloads: SnapVideoTokenPayload[] = [];

    for (const item of decodedPayloads) {
      const filename = (item.filename || '').toLowerCase();
      const directUrl = item.url.toLowerCase();

      if (
        filename.endsWith('.mp4') ||
        filename.endsWith('.mov') ||
        filename.endsWith('.webm') ||
        directUrl.includes('.mp4') ||
        directUrl.includes('/t2/f2/') ||
        directUrl.includes('/o1/v/t2/')
      ) {
        videoPayloads.push(item);
      } else if (
        filename.endsWith('.jpg') ||
        filename.endsWith('.jpeg') ||
        filename.endsWith('.png') ||
        filename.endsWith('.webp') ||
        directUrl.includes('.jpg') ||
        directUrl.includes('.jpeg')
      ) {
        photoPayloads.push(item);
      }
    }

    const candidateVariants: MediaVariant[] = [];
    let mediaType: MediaType = 'video';
    let thumbnailUrl: string | undefined;

    // Pick best thumbnail from photo payloads if available
    if (photoPayloads.length > 0) {
      thumbnailUrl = photoPayloads[0].url;
    }

    if (videoPayloads.length > 0) {
      mediaType = 'video';

      videoPayloads.forEach((vid, idx) => {
        const qualityName = idx === 0 ? 'HD Video (MP4)' : `Video Variant ${idx + 1}`;
        candidateVariants.push({
          id: `instagram-video-${idx + 1}`,
          url: vid.url,
          format: 'mp4',
          mimeType: 'video/mp4',
          quality: qualityName,
          hasWatermark: false,
        });
      });
    } else if (photoPayloads.length > 0) {
      // Photo / Carousel post
      mediaType = 'image';

      photoPayloads.forEach((photo, idx) => {
        candidateVariants.push({
          id: `instagram-image-${idx + 1}`,
          url: photo.url,
          format: 'jpeg',
          mimeType: 'image/jpeg',
          quality: `Photo ${idx + 1} of ${photoPayloads.length}`,
          hasWatermark: false,
        });
      });
    }

    if (candidateVariants.length === 0) {
      throw new DownloaderAppError(
        'RESOLUTION_FAILED',
        'Resolved Instagram post contained no accessible media streams.',
        404
      );
    }

    const isReel = /\/(?:reel|reels)\//i.test(targetUrl);
    const mediaId = shortcode || `ig_${Date.now()}`;
    const displayTitle = isReel
      ? `Instagram Reel (${mediaId})`
      : `Instagram Post (${mediaId})`;

    const resolved: ResolvedMedia = {
      id: mediaId,
      platform: 'instagram',
      sourceUrl: targetUrl,
      normalizedUrl: targetUrl,
      title: displayTitle,
      thumbnailUrl,
      mediaType,
      variants: candidateVariants,
      resolvedAt: new Date().toISOString(),
    };

    return resolved;
  }
}

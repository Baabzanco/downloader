import { MediaProvider } from '../BaseProvider.js';
import {
  PlatformId,
  ResolvedMedia,
  MediaVariant,
  MediaType,
} from '../../core/types.js';
import { DownloaderAppError } from '../../core/errors.js';
import { TikWMResponse } from './types.js';

interface CachedResolution {
  media: ResolvedMedia;
  cachedAt: number;
}

export class TikTokProvider implements MediaProvider {
  public readonly platform: PlatformId = 'tiktok';
  public readonly name = 'TikTok Provider';
  public readonly isEnabled = true;

  // Single-flight in-flight request deduplication map
  private inFlightRequests: Map<string, Promise<ResolvedMedia>> = new Map();
  // Short-lived resolution cache (5 minutes TTL) to reduce redundant upstream load
  private resolutionCache: Map<string, CachedResolution> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  // Mutex queue to pace outgoing upstream requests respecting 1 req/s free tier limit
  private lastUpstreamCallTime = 0;
  private readonly MIN_UPSTREAM_INTERVAL_MS = 1050; // 1.05s between upstream calls

  private getApiEndpoint(): string {
    return process.env.TIKTOK_PROVIDER_URL || 'https://www.tikwm.com/api/';
  }

  private getTimeoutMs(): number {
    const val = Number(process.env.TIKTOK_PROVIDER_TIMEOUT_MS);
    return !isNaN(val) && val > 0 ? val : 15000;
  }

  public canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    return (
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com') ||
      host === 'vm.tiktok.com' ||
      host === 'vt.tiktok.com'
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

    const resolutionPromise = this.executeResolutionWithPacing(targetUrl);
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
   * Paced upstream execution with retries on rate-limit
   */
  private async executeResolutionWithPacing(targetUrl: string): Promise<ResolvedMedia> {
    const maxRetries = 3;
    let attempt = 0;

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

      const controller = new AbortController();
      const timeoutMs = this.getTimeoutMs();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch(
          `${this.getApiEndpoint()}?url=${encodeURIComponent(targetUrl)}&hd=1`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
            signal: controller.signal,
          }
        );
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new DownloaderAppError(
            'TIMEOUT',
            `Media resolution timed out after ${timeoutMs}ms while contacting upstream provider.`,
            504
          );
        }
        throw new DownloaderAppError(
          'UPSTREAM_ERROR',
          `Network error contacting TikTok resolver: ${err instanceof Error ? err.message : String(err)}`,
          502
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        throw new DownloaderAppError(
          'UPSTREAM_ERROR',
          `TikTok resolver returned HTTP status ${res.status}.`,
          res.status >= 500 ? 502 : 400
        );
      }

      let payload: TikWMResponse;
      try {
        payload = (await res.json()) as TikWMResponse;
      } catch {
        throw new DownloaderAppError(
          'RESOLUTION_FAILED',
          'Failed to parse upstream response format as JSON.',
          502
        );
      }

      if (!payload || typeof payload !== 'object') {
        throw new DownloaderAppError(
          'RESOLUTION_FAILED',
          'Upstream provider returned an empty or invalid payload.',
          502
        );
      }

      const msg = payload.msg || '';
      const lower = msg.toLowerCase();

      // Detect upstream rate-limit message
      if (lower.includes('limit') || lower.includes('1 request/second') || payload.code === -1 && lower.includes('limit')) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1200 * attempt));
          continue;
        }
        throw new DownloaderAppError(
          'RATE_LIMITED',
          'Upstream resolver rate limit reached. Please wait a moment before trying again.',
          429
        );
      }

      if (payload.code !== 0 || !payload.data) {
        if (lower.includes('private')) {
          throw new DownloaderAppError(
            'PRIVATE_MEDIA',
            'This TikTok video is private or restricted by its author.',
            403
          );
        }
        if (
          lower.includes('not found') ||
          lower.includes('deleted') ||
          lower.includes('parsing is failed') ||
          lower.includes('video not found')
        ) {
          throw new DownloaderAppError(
            'MEDIA_NOT_FOUND',
            'The requested TikTok video could not be found or has been deleted.',
            404
          );
        }
        throw new DownloaderAppError('RESOLUTION_FAILED', msg || 'Unable to resolve media from this URL.', 400);
      }

      return this.mapPayloadToResolvedMedia(payload.data, targetUrl);
    }

    throw new DownloaderAppError(
      'RATE_LIMITED',
      'Exceeded retry attempts contacting upstream provider.',
      429
    );
  }

  private async mapPayloadToResolvedMedia(
    data: NonNullable<TikWMResponse['data']>,
    targetUrl: string
  ): Promise<ResolvedMedia> {
    const candidateVariants: MediaVariant[] = [];
    let mediaType: MediaType = 'video';

    // 1. Slideshow / photo post
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      mediaType = 'image';
      data.images.forEach((imgUrl, idx) => {
        if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
          candidateVariants.push({
            id: `image-${idx + 1}`,
            url: imgUrl,
            format: 'jpeg',
            mimeType: 'image/jpeg',
            quality: `Photo ${idx + 1} of ${data.images?.length}`,
            hasWatermark: false,
          });
        }
      });
    } else {
      // HD No-watermark video
      if (data.hdplay && typeof data.hdplay === 'string' && data.hdplay.startsWith('http')) {
        candidateVariants.push({
          id: 'video-no-watermark-hd',
          url: data.hdplay,
          format: 'mp4',
          mimeType: 'video/mp4',
          fileSize: data.hd_size && data.hd_size > 0 ? data.hd_size : undefined,
          quality: 'HD (No Watermark)',
          hasWatermark: false,
        });
      }

      // Standard No-watermark video
      if (data.play && typeof data.play === 'string' && data.play.startsWith('http')) {
        candidateVariants.push({
          id: 'video-no-watermark',
          url: data.play,
          format: 'mp4',
          mimeType: 'video/mp4',
          fileSize: data.size && data.size > 0 ? data.size : undefined,
          quality: data.hdplay ? 'Standard (No Watermark)' : 'No Watermark',
          hasWatermark: false,
        });
      }

      // Watermarked video
      if (data.wmplay && typeof data.wmplay === 'string' && data.wmplay.startsWith('http')) {
        candidateVariants.push({
          id: 'video-watermarked',
          url: data.wmplay,
          format: 'mp4',
          mimeType: 'video/mp4',
          fileSize: data.wm_size && data.wm_size > 0 ? data.wm_size : undefined,
          quality: 'Original Watermarked',
          hasWatermark: true,
        });
      }
    }

    // Audio stream (MP3)
    const audioUrl = data.music || data.music_info?.play;
    if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
      candidateVariants.push({
        id: 'audio-original',
        url: audioUrl,
        format: 'mp3',
        mimeType: 'audio/mpeg',
        quality: data.music_info?.title ? `Audio: ${data.music_info.title}` : 'Original Audio',
        hasWatermark: false,
      });
    }

    if (candidateVariants.length === 0) {
      throw new DownloaderAppError(
        'RESOLUTION_FAILED',
        'Resolved video contained no accessible media streams.',
        404
      );
    }

    const resolved: ResolvedMedia = {
      id: data.id || String(Date.now()),
      platform: 'tiktok',
      sourceUrl: targetUrl,
      normalizedUrl: targetUrl,
      title: (data.title || 'TikTok Video').trim(),
      author: {
        id: data.author?.id,
        name: data.author?.nickname || data.author?.unique_id,
        username: data.author?.unique_id,
        avatarUrl: data.author?.avatar,
      },
      thumbnailUrl: data.cover || data.origin_cover || data.ai_dynamic_cover,
      duration: typeof data.duration === 'number' ? data.duration : undefined,
      mediaType,
      variants: candidateVariants,
      stats: {
        views: data.play_count,
        likes: data.digg_count,
        comments: data.comment_count,
        shares: data.share_count,
        downloads: data.download_count,
      },
      resolvedAt: new Date().toISOString(),
    };

    return resolved;
  }
}

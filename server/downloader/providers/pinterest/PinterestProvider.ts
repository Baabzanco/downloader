import { MediaProvider } from '../BaseProvider.js';
import { PlatformId, ResolvedMedia, MediaVariant } from '../../core/types.js';
import { DownloaderAppError } from '../../core/errors.js';
import { SecurityValidator } from '../../core/SecurityValidator.js';
import { PinterestResourceResponse, PinterestPinData, PinterestVideoList } from './types.js';
import * as cheerio from 'cheerio';

interface CachedResolution {
  media: ResolvedMedia;
  cachedAt: number;
}

export class PinterestProvider implements MediaProvider {
  public readonly platform: PlatformId = 'pinterest';
  public readonly name = 'Pinterest Provider';
  public readonly isEnabled = true;

  // Short-lived resolution cache keyed by canonical pinId (5 minutes TTL)
  private readonly resolutionCache = new Map<string, CachedResolution>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  // Active in-flight requests for request deduplication keyed by canonical pinId
  private readonly inFlightRequests = new Map<string, Promise<ResolvedMedia>>();

  // Mutex queue to pace outgoing upstream requests across concurrent calls
  private pacingQueue: Promise<void> = Promise.resolve();
  private lastUpstreamCallTime = 0;
  private readonly MIN_UPSTREAM_INTERVAL_MS = 400;

  private getTimeoutMs(): number {
    const val = Number(process.env.PINTEREST_PROVIDER_TIMEOUT_MS);
    return !isNaN(val) && val > 0 ? val : 15000;
  }

  public canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const isPinterestHost =
      host === 'pinterest.com' ||
      host.endsWith('.pinterest.com') ||
      host === 'pin.it' ||
      host.endsWith('.pin.it');

    if (!isPinterestHost) return false;

    // Check for short link or pin ID path
    return host === 'pin.it' || /\/pin\/\d+/i.test(url.pathname);
  }

  public async resolve(url: URL): Promise<ResolvedMedia> {
    // 1. Resolve canonical Pin ID first (handles pin.it redirects safely and strips all query params)
    const pinId = await this.extractOrResolvePinId(url);
    const canonicalKey = `pinterest:${pinId}`;

    // 2. Check short-lived cache by canonical key
    const cached = this.resolutionCache.get(canonicalKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.media;
    }

    // 3. Request coalescing for concurrent requests for the same Pin ID
    const inFlight = this.inFlightRequests.get(canonicalKey);
    if (inFlight) {
      return inFlight;
    }

    const resolutionPromise = this.enqueuePacedResolution(pinId, url.toString());
    this.inFlightRequests.set(canonicalKey, resolutionPromise);

    try {
      const result = await resolutionPromise;
      this.resolutionCache.set(canonicalKey, {
        media: result,
        cachedAt: Date.now(),
      });
      return result;
    } finally {
      this.inFlightRequests.delete(canonicalKey);
    }
  }

  /**
   * Safely resolves pin.it short URLs or extracts numeric Pin ID from standard URLs
   */
  private async extractOrResolvePinId(initialUrl: URL): Promise<string> {
    const host = initialUrl.hostname.toLowerCase();

    // Standard Pinterest URL
    if (host !== 'pin.it') {
      const pathMatch = initialUrl.pathname.match(/\/pin\/(\d+)/i);
      if (pathMatch) {
        return pathMatch[1];
      }
      throw new DownloaderAppError(
        'INVALID_URL',
        'Invalid Pinterest URL format. Must contain a numeric Pin ID (e.g. /pin/1234567890/).',
        400
      );
    }

    // Short link (pin.it) resolution with hop-by-hop security validation
    let currentUrl = initialUrl;
    let hops = 0;
    const MAX_HOPS = 5;

    while (hops < MAX_HOPS) {
      hops++;
      try {
        const headRes = await fetch(currentUrl.toString(), {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
        });

        if ([301, 302, 303, 307, 308].includes(headRes.status)) {
          const loc = headRes.headers.get('location');
          if (!loc) {
            throw new DownloaderAppError('UPSTREAM_ERROR', 'pin.it redirect missing Location header.', 502);
          }
          const nextUrl = new URL(loc, currentUrl);

          // Validate target host is strictly pinterest.com or pin.it
          const nextHost = nextUrl.hostname.toLowerCase();
          const isAllowedHost =
            nextHost === 'pinterest.com' ||
            nextHost.endsWith('.pinterest.com') ||
            nextHost === 'pin.it';

          if (!isAllowedHost) {
            throw new DownloaderAppError(
              'INVALID_URL',
              `pin.it short link redirected to unauthorized domain "${nextHost}".`,
              400
            );
          }

          const pathMatch = nextUrl.pathname.match(/\/pin\/(\d+)/i);
          if (pathMatch) {
            return pathMatch[1];
          }

          currentUrl = nextUrl;
          continue;
        }

        // If not a redirect, inspect current pathname
        const finalMatch = currentUrl.pathname.match(/\/pin\/(\d+)/i);
        if (finalMatch) {
          return finalMatch[1];
        }

        break;
      } catch (err) {
        if (err instanceof DownloaderAppError) throw err;
        throw new DownloaderAppError(
          'UPSTREAM_ERROR',
          `Failed to expand Pinterest short URL: ${err instanceof Error ? err.message : String(err)}`,
          502
        );
      }
    }

    throw new DownloaderAppError(
      'INVALID_URL',
      'Unable to locate a valid numeric Pin ID from the provided pin.it short URL.',
      400
    );
  }

  /**
   * Enqueues resolution through the mutex pacing queue to guarantee at least 400ms between upstream calls
   */
  private async enqueuePacedResolution(pinId: string, originalSourceUrl: string): Promise<ResolvedMedia> {
    // Chain onto pacingQueue
    const previousPacing = this.pacingQueue;
    let releasePacing: () => void = () => {};
    this.pacingQueue = new Promise<void>((resolve) => {
      releasePacing = resolve;
    });

    await previousPacing;

    try {
      const now = Date.now();
      const timeSinceLast = now - this.lastUpstreamCallTime;
      if (timeSinceLast < this.MIN_UPSTREAM_INTERVAL_MS) {
        const waitMs = this.MIN_UPSTREAM_INTERVAL_MS - timeSinceLast;
        await new Promise((r) => setTimeout(r, waitMs));
      }
      this.lastUpstreamCallTime = Date.now();

      return await this.fetchAndExtractPinData(pinId, originalSourceUrl);
    } finally {
      releasePacing();
    }
  }

  /**
   * Executes upstream requests with isolated per-request session context
   */
  private async fetchAndExtractPinData(pinId: string, originalSourceUrl: string): Promise<ResolvedMedia> {
    const timeoutMs = this.getTimeoutMs();

    // Step 1: Request public Pin page to acquire session context & cookies
    // (Per-request local variables ensure zero cross-request cookie or session leakage)
    let pageHtml: string;
    let cookieHeader = '';
    let csrfToken = '';
    let initialHandlerId = 'www/pin/[id].js';

    try {
      const pageController = new AbortController();
      const pageTimeout = setTimeout(() => pageController.abort(), timeoutMs);

      const pageRes = await fetch(`https://www.pinterest.com/pin/${pinId}/`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
        signal: pageController.signal,
      });

      clearTimeout(pageTimeout);

      if (pageRes.status === 404) {
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'This Pinterest Pin does not exist or has been deleted.',
          404
        );
      }

      const cookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [];
      for (const c of cookies) {
        const match = c.match(/csrftoken=([^;]+)/);
        if (match) csrfToken = match[1];
      }
      cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
      pageHtml = await pageRes.text();
    } catch (err: unknown) {
      if (err instanceof DownloaderAppError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new DownloaderAppError(
          'TIMEOUT',
          `Request to Pinterest timed out after ${timeoutMs}ms.`,
          504
        );
      }
      throw new DownloaderAppError(
        'UPSTREAM_ERROR',
        `Failed to reach Pinterest: ${err instanceof Error ? err.message : String(err)}`,
        502
      );
    }

    // Parse PWS data if available
    try {
      const $ = cheerio.load(pageHtml);
      const pwsText = $('#__PWS_DATA__').text();
      if (pwsText) {
        const pws = JSON.parse(pwsText);
        if (pws.initialHandlerId) {
          initialHandlerId = pws.initialHandlerId;
        }
      }
    } catch {
      // Use default handler
    }

    // Step 2: Query Pinterest PinResource API
    const dataParam = JSON.stringify({
      options: {
        id: pinId,
        field_set_key: 'detailed',
      },
      context: {},
    });

    const resourceUrl = `https://www.pinterest.com/resource/PinResource/get/?source_url=%2Fpin%2F${pinId}%2F&data=${encodeURIComponent(
      dataParam
    )}`;

    let resourceData: PinterestResourceResponse;
    try {
      const resController = new AbortController();
      const resTimeout = setTimeout(() => resController.abort(), timeoutMs);

      const res = await fetch(resourceUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Pinterest-Pws-Handler': initialHandlerId,
          'X-Pinterest-AppState': 'active',
          'X-Pinterest-Source-Url': `/pin/${pinId}/`,
          'X-CSRFToken': csrfToken,
          Cookie: cookieHeader,
          Referer: `https://www.pinterest.com/pin/${pinId}/`,
          Accept: 'application/json, text/javascript, */*; q=0.01',
        },
        signal: resController.signal,
      });

      clearTimeout(resTimeout);

      if (res.status === 404) {
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'This Pinterest Pin does not exist or has been removed.',
          404
        );
      }

      if (!res.ok) {
        throw new DownloaderAppError(
          'UPSTREAM_ERROR',
          `Pinterest resource API returned status ${res.status}.`,
          res.status >= 500 ? 502 : 500
        );
      }

      resourceData = (await res.json()) as PinterestResourceResponse;
    } catch (err: unknown) {
      if (err instanceof DownloaderAppError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new DownloaderAppError(
          'TIMEOUT',
          `Pinterest resource request timed out after ${timeoutMs}ms.`,
          504
        );
      }
      throw new DownloaderAppError(
        'UPSTREAM_ERROR',
        `Failed to parse response from Pinterest API: ${err instanceof Error ? err.message : String(err)}`,
        502
      );
    }

    const pin: PinterestPinData | null | undefined = resourceData.resource_response?.data;
    if (!pin) {
      const errorMsg = resourceData.resource_response?.error?.message;
      if (errorMsg && errorMsg.includes('Pin not found')) {
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'This Pinterest Pin does not exist or has been deleted.',
          404
        );
      }
      throw new DownloaderAppError(
        'MEDIA_NOT_FOUND',
        'Unable to retrieve data for this Pinterest Pin.',
        404
      );
    }

    // Step 3: Extract video variants
    const variants: MediaVariant[] = [];
    let videoList: PinterestVideoList | undefined;

    if (pin.videos?.video_list) {
      videoList = pin.videos.video_list;
    } else if (pin.story_pin_data?.pages && pin.story_pin_data.pages.length > 0) {
      for (const page of pin.story_pin_data.pages) {
        if (page.blocks) {
          for (const block of page.blocks) {
            if (block.video?.video_list) {
              videoList = block.video.video_list;
              break;
            }
          }
        }
        if (videoList) break;
      }
    }

    if (!videoList || Object.keys(videoList).length === 0) {
      throw new DownloaderAppError(
        'MEDIA_NOT_FOUND',
        'No downloadable video found in this Pinterest Pin (image-only or non-video Pin).',
        404
      );
    }

    // Map known resolution keys
    const qualityPriority = [
      { key: 'V_720P', label: '720p HD Video', defaultHeight: 1280, defaultWidth: 720 },
      { key: 'V_EXP7', label: '720p HD Video', defaultHeight: 1280, defaultWidth: 720 },
      { key: 'V_EXP6', label: '540p Video', defaultHeight: 960, defaultWidth: 540 },
      { key: 'V_EXP5', label: '480p Video', defaultHeight: 854, defaultWidth: 480 },
      { key: 'V_EXP4', label: '360p Video', defaultHeight: 640, defaultWidth: 360 },
      { key: 'V_EXP3', label: '240p Video', defaultHeight: 426, defaultWidth: 240 },
      { key: 'V_EXP2', label: '240p Video', defaultHeight: 426, defaultWidth: 240 },
      { key: 'V_EXP1', label: '180p Video', defaultHeight: 320, defaultWidth: 180 },
    ];

    let durationSeconds: number | undefined;
    let primaryThumbnail: string | undefined;

    for (const q of qualityPriority) {
      const item = videoList[q.key];
      if (item?.url && item.url.includes('.mp4')) {
        // Validate URL against strict Video CDN trust boundary
        SecurityValidator.validateMediaStreamUrl(item.url);

        if (!durationSeconds && item.duration) {
          durationSeconds = item.duration > 1000 ? Math.round(item.duration / 1000) : item.duration;
        }
        if (!primaryThumbnail && item.thumbnail) {
          primaryThumbnail = item.thumbnail;
        }

        // Avoid duplicate URLs
        if (!variants.some((v) => v.url === item.url)) {
          variants.push({
            id: `pinterest-${q.key.toLowerCase()}-${pinId}`,
            url: item.url,
            format: 'mp4',
            mimeType: 'video/mp4',
            width: item.width || q.defaultWidth,
            height: item.height || q.defaultHeight,
            quality: q.label,
            hasAudio: true,
            hasVideo: true,
            videoCodec: 'h264',
            audioCodec: 'aac',
          });
        }
      }
    }

    // Also check any other MP4 video items in videoList
    for (const [key, item] of Object.entries(videoList)) {
      if (item?.url && item.url.includes('.mp4')) {
        if (!variants.some((v) => v.url === item.url)) {
          SecurityValidator.validateMediaStreamUrl(item.url);
          variants.push({
            id: `pinterest-${key.toLowerCase()}-${pinId}`,
            url: item.url,
            format: 'mp4',
            mimeType: 'video/mp4',
            width: item.width,
            height: item.height,
            quality: 'MP4 Video',
            hasAudio: true,
            hasVideo: true,
            videoCodec: 'h264',
            audioCodec: 'aac',
          });
        }
      }
    }

    if (variants.length === 0) {
      throw new DownloaderAppError(
        'MEDIA_NOT_FOUND',
        'No direct MP4 video streams could be extracted from this Pinterest Pin.',
        404
      );
    }

    // Step 4: Metadata resolution
    const title =
      pin.title?.trim() ||
      pin.grid_title?.trim() ||
      pin.description?.trim() ||
      'Pinterest Video';

    const thumbnailUrl =
      primaryThumbnail ||
      pin.images?.orig?.url ||
      pin.images?.['736x']?.url ||
      pin.images?.['564x']?.url;

    const resolvedMedia: ResolvedMedia = {
      id: pinId,
      platform: 'pinterest',
      sourceUrl: originalSourceUrl,
      normalizedUrl: `https://www.pinterest.com/pin/${pinId}/`,
      title,
      author: pin.pinner
        ? {
            id: pin.pinner.id,
            name: pin.pinner.full_name || pin.pinner.username,
            username: pin.pinner.username,
            avatarUrl: pin.pinner.image_large_url,
          }
        : undefined,
      thumbnailUrl,
      duration: durationSeconds,
      mediaType: 'video',
      variants,
      stats: {
        shares: pin.repin_count,
        comments: pin.comment_count,
      },
      resolvedAt: new Date().toISOString(),
    };

    return resolvedMedia;
  }
}

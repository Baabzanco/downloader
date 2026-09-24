import { MediaProvider } from '../BaseProvider.js';
import { PlatformId, ResolvedMedia, MediaVariant } from '../../core/types.js';
import { DownloaderAppError } from '../../core/errors.js';
import { SecurityValidator } from '../../core/SecurityValidator.js';

interface CachedResolution {
  media: ResolvedMedia;
  cachedAt: number;
}

export class TwitterProvider implements MediaProvider {
  public readonly platform: PlatformId = 'twitter';
  public readonly name = 'Twitter Provider';
  public readonly isEnabled = true;

  // Short-lived resolution cache (5 minutes TTL) to reduce redundant upstream load
  private readonly resolutionCache = new Map<string, CachedResolution>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  // Active in-flight requests for request deduplication/coalescing
  private readonly inFlightRequests = new Map<string, Promise<ResolvedMedia>>();

  // Mutex queue to pace outgoing upstream requests
  private lastUpstreamCallTime = 0;
  private readonly MIN_UPSTREAM_INTERVAL_MS = 500; // 500ms pacing for courtesy

  private getToken(id: string): string {
    if (!id || !/^\d{1,25}$/.test(id)) {
      throw new DownloaderAppError(
        'INVALID_URL',
        'Invalid tweet status ID. Must be a numeric string.',
        400
      );
    }
    const num = Number(id);
    if (!Number.isFinite(num) || num <= 0) {
      throw new DownloaderAppError(
        'INVALID_URL',
        'Tweet status ID is out of valid numeric range.',
        400
      );
    }
    return (num / 1e15 * Math.PI).toString(36).replace(/(0+|\.)/g, '');
  }

  private getTimeoutMs(): number {
    const val = Number(process.env.TWITTER_PROVIDER_TIMEOUT_MS);
    return !isNaN(val) && val > 0 ? val : 15000;
  }

  public canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const isTwitterHost =
      host === 'twitter.com' ||
      host.endsWith('.twitter.com') ||
      host === 'x.com' ||
      host.endsWith('.x.com');

    if (!isTwitterHost) return false;

    // Must have a status pattern
    return /\/status\/\d+/i.test(url.pathname);
  }

  public async resolve(url: URL): Promise<ResolvedMedia> {
    const targetUrl = url.toString();

    // 1. Check short-lived cache
    const cached = this.resolutionCache.get(targetUrl);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.media;
    }

    // 2. Request coalescing
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

  private async executeResolutionWithPacing(url: URL): Promise<ResolvedMedia> {
    const targetUrl = url.toString();
    const pathMatch = url.pathname.match(/\/([^/]+)\/status\/(\d+)/i);
    if (!pathMatch) {
      throw new DownloaderAppError(
        'INVALID_URL',
        'Invalid Twitter/X post URL format. Must contain status ID (e.g. /status/12345).',
        400
      );
    }

    const tweetId = pathMatch[2];

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

    const syndicationUrl = new URL('https://cdn.syndication.twimg.com/tweet-result');
    syndicationUrl.searchParams.set('id', tweetId);
    syndicationUrl.searchParams.set('lang', 'en');
    syndicationUrl.searchParams.set('features', [
      'tfw_timeline_list:',
      'tfw_follower_count_sunset:true',
      'tfw_tweet_edit_backend:on',
      'tfw_refsrc_session:on',
      'tfw_fosnr_soft_interventions_enabled:on',
      'tfw_show_birdwatch_pivots_enabled:on',
      'tfw_show_business_verified_badge:on',
      'tfw_duplicate_scribes_to_settings:on',
      'tfw_use_profile_image_shape_enabled:on',
      'tfw_show_blue_verified_badge:on',
      'tfw_legacy_timeline_sunset:true',
      'tfw_show_gov_verified_badge:on',
      'tfw_show_business_affiliate_badge:on',
      'tfw_tweet_edit_frontend:on'
    ].join(';'));
    syndicationUrl.searchParams.set('token', this.getToken(tweetId));

    let res: Response;
    try {
      res = await fetch(syndicationUrl.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new DownloaderAppError(
          'TIMEOUT',
          `Request to Twitter syndication API timed out after ${timeoutMs}ms.`,
          504
        );
      }
      throw new DownloaderAppError(
        'UPSTREAM_ERROR',
        `Network error calling Twitter syndication API: ${err instanceof Error ? err.message : String(err)}`,
        502
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 404) {
      throw new DownloaderAppError(
        'MEDIA_NOT_FOUND',
        'This tweet does not exist, has been deleted, or is private.',
        404
      );
    }

    if (!res.ok) {
      throw new DownloaderAppError(
        'UPSTREAM_ERROR',
        `Twitter syndication API returned non-OK status: ${res.status}`,
        res.status >= 500 ? 502 : 500
      );
    }

    let data: any;
    try {
      data = await res.json();
    } catch (err) {
      throw new DownloaderAppError(
        'UPSTREAM_ERROR',
        'Failed to parse JSON response from Twitter syndication API.',
        502
      );
    }

    // Check tombstone (private/deleted)
    if (data?.__typename === 'TweetTombstone' || (data && Object.keys(data).length === 0)) {
      throw new DownloaderAppError(
        'PRIVATE_MEDIA',
        'This tweet is inaccessible because it is private, protected, or has been deleted.',
        403
      );
    }

    // Extract video variants
    const variants: MediaVariant[] = [];
    let durationSeconds: number | undefined;
    let thumbnailUrl: string | undefined;

    // 1. Check direct video property
    if (data?.video) {
      const durationMs = Number(data.video.durationMs);
      if (!isNaN(durationMs)) {
        durationSeconds = durationMs / 1000;
      }
      thumbnailUrl = data.video.poster;

      if (Array.isArray(data.video.variants)) {
        for (const v of data.video.variants) {
          if (v.src && (v.type === 'video/mp4' || v.type?.includes('mp4'))) {
            // Validate SSRF security boundaries
            SecurityValidator.validateMediaStreamUrl(v.src);
            variants.push({
              id: `twitter-mp4-${v.src.split('/').pop()?.split('?')[0] || Math.random().toString(36).substring(7)}`,
              url: v.src,
              format: 'mp4',
              mimeType: 'video/mp4',
              quality: v.src.includes('vid/') ? 'MP4' : 'Original',
              hasAudio: true,
              hasVideo: true,
            });
          }
        }
      }
    }

    // 2. Fallback or additional check inside mediaDetails
    if (Array.isArray(data?.mediaDetails)) {
      for (const m of data.mediaDetails) {
        if ((m.type === 'video' || m.type === 'animated_gif') && m.video_info?.variants) {
          if (!thumbnailUrl && m.media_url_https) {
            thumbnailUrl = m.media_url_https;
          }

          for (const v of m.video_info.variants) {
            if (v.url && (v.content_type === 'video/mp4' || v.content_type?.includes('mp4'))) {
              SecurityValidator.validateMediaStreamUrl(v.url);

              const bitrate = Number(v.bitrate);
              const qualityLabel = bitrate ? `${Math.round(bitrate / 1000)}kbps` : 'MP4';

              // Avoid duplicate URLs
              if (!variants.some((existing) => existing.url === v.url)) {
                variants.push({
                  id: `twitter-mp4-${v.url.split('/').pop()?.split('?')[0] || Math.random().toString(36).substring(7)}`,
                  url: v.url,
                  format: 'mp4',
                  mimeType: 'video/mp4',
                  bitrate: bitrate || undefined,
                  quality: qualityLabel,
                  hasAudio: m.type === 'video',
                  hasVideo: true,
                });
              }
            }
          }
        }
      }
    }

    if (variants.length === 0) {
      throw new DownloaderAppError(
        'MEDIA_NOT_FOUND',
        'No downloadable video or MP4 media found in this tweet.',
        404
      );
    }

    // Sort variants by bitrate (highest quality first)
    variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    // Fill in quality labels if we have multiple resolutions
    if (variants.length > 1) {
      variants[0].quality = 'HD Video';
      for (let i = 1; i < variants.length; i++) {
        variants[i].quality = variants[i].quality || 'SD Video';
      }
    }

    const resolvedMedia: ResolvedMedia = {
      id: tweetId,
      platform: 'twitter',
      sourceUrl: targetUrl,
      normalizedUrl: url.toString(),
      title: data.text || '',
      author: data.user
        ? {
            id: data.user.id_str,
            name: data.user.name,
            username: data.user.screen_name,
            avatarUrl: data.user.profile_image_url_https,
            verified: data.user.verified,
          }
        : undefined,
      thumbnailUrl: thumbnailUrl || data.user?.profile_image_url_https,
      duration: durationSeconds,
      mediaType: 'video',
      variants,
      resolvedAt: new Date().toISOString(),
    };

    return resolvedMedia;
  }
}

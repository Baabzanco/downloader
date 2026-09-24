import { MediaProvider } from '../BaseProvider.js';
import { PlatformId, ResolvedMedia, MediaVariant } from '../../core/types.js';
import { DownloaderAppError } from '../../core/errors.js';
import { SecurityValidator } from '../../core/SecurityValidator.js';
import { LoaderToInitResponse, LoaderToProgressResponse, YouTubeOEmbedResponse } from './types.js';

export class YouTubeProvider implements MediaProvider {
  public readonly platform: PlatformId = 'youtube';
  public readonly name = 'YouTube Shorts & Video Provider';
  public readonly isEnabled = true;

  // Short-lived resolution cache: key = normalizedUrl, value = ResolvedMedia
  private readonly resolutionCache = new Map<string, { media: ResolvedMedia; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Active in-flight requests for request deduplication/coalescing
  private readonly inFlightRequests = new Map<string, Promise<ResolvedMedia>>();

  // Mutex queue to pace outgoing upstream requests respecting rate limits
  private lastUpstreamCallTime = 0;
  private readonly MIN_UPSTREAM_INTERVAL_MS = 1000; // 1.0s between upstream calls

  private getTimeoutMs(): number {
    const val = Number(process.env.YOUTUBE_PROVIDER_TIMEOUT_MS);
    return !isNaN(val) && val > 0 ? val : 35000;
  }

  public canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const isYouTubeHost =
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be';

    if (!isYouTubeHost) return false;

    const pathname = url.pathname;
    const hasWatchV = /\/watch/i.test(pathname) && Boolean(url.searchParams.get('v'));
    const hasShorts = /\/shorts\/[A-Za-z0-9_-]+/i.test(pathname);
    const hasYoutuBe = host === 'youtu.be' && /^\/[A-Za-z0-9_-]+$/.test(pathname);

    return hasShorts || hasWatchV || hasYoutuBe;
  }

  public async resolve(url: URL): Promise<ResolvedMedia> {
    const videoId = this.extractVideoId(url);
    const isShort = /\/shorts\//i.test(url.pathname);
    const canonicalKey = isShort
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`;

    // 1. Check short-lived cache using canonical URL key
    const cached = this.resolutionCache.get(canonicalKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.media;
    }

    // 2. Request coalescing: if identical canonical URL is currently resolving, join existing promise
    const inFlight = this.inFlightRequests.get(canonicalKey);
    if (inFlight) {
      return inFlight;
    }

    const resolutionPromise = this.executeResolutionWithPacing(url, canonicalKey, videoId, isShort);
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

  public clearCache(): void {
    this.resolutionCache.clear();
  }

  public getCacheSize(): number {
    return this.resolutionCache.size;
  }

  /**
   * Coordinates rate-limited execution of upstream resolution
   */
  private async executeResolutionWithPacing(
    url: URL,
    canonicalUrl: string,
    videoId: string,
    isShort: boolean
  ): Promise<ResolvedMedia> {
    const now = Date.now();
    const elapsed = now - this.lastUpstreamCallTime;
    if (elapsed < this.MIN_UPSTREAM_INTERVAL_MS) {
      const delay = this.MIN_UPSTREAM_INTERVAL_MS - elapsed;
      await new Promise((r) => setTimeout(r, delay));
    }
    this.lastUpstreamCallTime = Date.now();

    // 1. Verify existence & fetch metadata via official YouTube oEmbed endpoint
    let oembedData: YouTubeOEmbedResponse | null = null;
    try {
      oembedData = await this.fetchOEmbed(videoId);
    } catch (err: any) {
      if (err instanceof DownloaderAppError) {
        throw err;
      }
      // If oEmbed encounters transient network issue, continue to upstream resolver
    }

    // 2. Resolve media stream via upstream engine with polling
    const streamInfo = await this.resolveStreamUrl(canonicalUrl, videoId);

    // 3. SSRF & Domain Validation on resulting media stream
    const validatedStreamUrl = SecurityValidator.validateMediaStreamUrl(streamInfo.downloadUrl);

    // 4. Assemble canonical metadata
    const title =
      oembedData?.title ||
      streamInfo.title ||
      `YouTube ${isShort ? 'Short' : 'Video'} (${videoId})`;

    const author = oembedData?.author_name
      ? {
          name: oembedData.author_name,
        }
      : undefined;

    const thumbnailUrl =
      oembedData?.thumbnail_url ||
      streamInfo.thumbnailUrl ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const variant: MediaVariant = {
      id: 'youtube-video-720p',
      url: validatedStreamUrl.toString(),
      format: 'mp4',
      mimeType: 'video/mp4',
      quality: '720p (HD)',
      hasWatermark: false,
      hasAudio: true,
      hasVideo: true,
      videoCodec: 'h264',
      audioCodec: 'aac',
    };

    const resolved: ResolvedMedia = {
      id: videoId,
      platform: 'youtube',
      sourceUrl: url.toString(),
      normalizedUrl: canonicalUrl,
      title,
      author,
      thumbnailUrl,
      mediaType: 'video',
      variants: [variant],
      resolvedAt: new Date().toISOString(),
    };

    return resolved;
  }

  /**
   * Queries official YouTube oEmbed API to verify public accessibility and retrieve verified title
   */
  private async fetchOEmbed(videoId: string): Promise<YouTubeOEmbedResponse | null> {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(
      videoId
    )}&format=json`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(oembedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });

      if (res.status === 404) {
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'This YouTube video could not be found or has been removed.',
          404
        );
      }

      if (res.status === 401 || res.status === 403) {
        throw new DownloaderAppError(
          'PRIVATE_MEDIA',
          'This YouTube video is private or restricted.',
          403
        );
      }

      if (!res.ok) {
        return null;
      }

      return (await res.json()) as YouTubeOEmbedResponse;
    } catch (err: any) {
      if (err instanceof DownloaderAppError) {
        throw err;
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Resolves the direct media stream URL from the upstream processing engine
   */
  private async resolveStreamUrl(
    canonicalUrl: string,
    videoId: string
  ): Promise<{ downloadUrl: string; title?: string; thumbnailUrl?: string }> {
    const timeoutMs = this.getTimeoutMs();
    const startTime = Date.now();

    const initUrl = `https://loader.to/ajax/download.php?button=1&start=1&end=1&format=720&url=${encodeURIComponent(
      canonicalUrl
    )}`;

    let initData: LoaderToInitResponse;
    try {
      const initRes = await fetch(initUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (initRes.status === 429) {
        throw new DownloaderAppError(
          'RATE_LIMITED',
          'Upstream resolution engine is temporarily rate-limited. Please retry shortly.',
          429
        );
      }

      if (initRes.status === 400) {
        const errJson = (await initRes.json().catch(() => null)) as LoaderToInitResponse | null;
        if (errJson?.message?.includes('Invalid YouTube video ID')) {
          throw new DownloaderAppError(
            'INVALID_URL',
            'Invalid YouTube video ID. YouTube IDs must be 11 characters.',
            400
          );
        }
      }

      if (!initRes.ok) {
        throw new DownloaderAppError(
          'UPSTREAM_ERROR',
          `Upstream resolution engine returned HTTP ${initRes.status}. Service temporarily unavailable.`,
          502
        );
      }

      const rawInitText = await initRes.text();
      try {
        initData = JSON.parse(rawInitText) as LoaderToInitResponse;
      } catch {
        throw new DownloaderAppError(
          'RESOLUTION_FAILED',
          'Upstream resolution engine returned malformed JSON response.',
          502
        );
      }
    } catch (err: any) {
      if (err instanceof DownloaderAppError) throw err;
      if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
        throw new DownloaderAppError(
          'TIMEOUT',
          'Upstream resolution engine timed out while initializing stream.',
          504
        );
      }
      throw new DownloaderAppError(
        'RESOLUTION_FAILED',
        `Failed to reach YouTube upstream resolver: ${err.message}`,
        502
      );
    }

    if (!initData.success || !initData.id) {
      if (initData.message?.toLowerCase().includes('private')) {
        throw new DownloaderAppError('PRIVATE_MEDIA', 'This YouTube video is private.', 403);
      }
      throw new DownloaderAppError(
        'MEDIA_NOT_FOUND',
        initData.message || 'Unable to resolve YouTube video streams.',
        404
      );
    }

    // Determine progress polling endpoint and validate against SSRF
    const rawProgressUrl =
      initData.progress_url || `https://lto2.affadaffa.com/api/progress?id=${encodeURIComponent(initData.id)}`;
    try {
      const parsedProgress = new URL(rawProgressUrl);
      SecurityValidator.checkSSRFSync(parsedProgress.hostname);
    } catch {
      throw new DownloaderAppError(
        'SSRF_ATTEMPT',
        'Invalid or prohibited progress URL returned from upstream.',
        403
      );
    }

    // Poll until stream is ready or timeout occurs with adaptive pacing
    let pollInterval = 1200;
    let rateLimitHits = 0;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollInterval));
      pollInterval = Math.min(2500, pollInterval + 200);

      try {
        const progressRes = await fetch(rawProgressUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (progressRes.status === 429) {
          rateLimitHits++;
          if (rateLimitHits > 2) {
            throw new DownloaderAppError(
              'RATE_LIMITED',
              'Upstream progress polling rate limit encountered. Please retry shortly.',
              429
            );
          }
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        if (!progressRes.ok) {
          continue;
        }

        let progressData: LoaderToProgressResponse;
        try {
          progressData = (await progressRes.json()) as LoaderToProgressResponse;
        } catch {
          continue;
        }

        if (progressData.download_url && progressData.download_url.length > 5) {
          return {
            downloadUrl: progressData.download_url,
            title: initData.title || initData.info?.title || undefined,
            thumbnailUrl: initData.thumbnail_url || initData.info?.image || undefined,
          };
        }

        // Check if upstream indicates an error message
        if (progressData.text?.toLowerCase().includes('error') || progressData.message?.toLowerCase().includes('error')) {
          throw new DownloaderAppError(
            'RESOLUTION_FAILED',
            progressData.message || progressData.text || 'Upstream failed to process YouTube media.',
            502
          );
        }
      } catch (err: any) {
        if (err instanceof DownloaderAppError) throw err;
        // Network blips during polling can be retried within the timeout window
      }
    }

    throw new DownloaderAppError(
      'TIMEOUT',
      'Timeout waiting for YouTube video stream processing to complete.',
      504
    );
  }

  /**
   * Extracts clean 11-character YouTube video ID from URL
   */
  public extractVideoId(url: URL): string {
    const host = url.hostname.toLowerCase();

    // 1. youtu.be/{id}
    if (host === 'youtu.be') {
      const match = url.pathname.match(/^\/([A-Za-z0-9_-]{11})(?:\/|$)/);
      if (match) return match[1];
    }

    // 2. /shorts/{id}
    const shortsMatch = url.pathname.match(/\/shorts\/([A-Za-z0-9_-]{11})(?:\/|$)/);
    if (shortsMatch) return shortsMatch[1];

    // 3. /watch?v={id}
    const vParam = url.searchParams.get('v');
    if (vParam && /^[A-Za-z0-9_-]{11}$/.test(vParam)) {
      return vParam;
    }

    // 4. Fallback search in pathname
    const genericMatch = url.pathname.match(/\/([A-Za-z0-9_-]{11})(?:\/|$)/);
    if (genericMatch) return genericMatch[1];

    throw new DownloaderAppError(
      'INVALID_URL',
      'Invalid YouTube video ID format. YouTube IDs must be 11 characters.',
      400
    );
  }
}

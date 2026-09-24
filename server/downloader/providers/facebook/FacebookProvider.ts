import { MediaProvider } from '../BaseProvider.js';
import { PlatformId, ResolvedMedia, MediaVariant } from '../../core/types.js';
import { DownloaderAppError } from '../../core/errors.js';
import { SecurityValidator } from '../../core/SecurityValidator.js';
import { SnapSaveTokenPayload } from './types.js';

export class FacebookProvider implements MediaProvider {
  public readonly platform: PlatformId = 'facebook';
  public readonly name = 'Facebook Provider';
  public readonly isEnabled = true;

  // Short-lived resolution cache: key = normalizedUrl, value = ResolvedMedia
  private readonly resolutionCache = new Map<string, { media: ResolvedMedia; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Active in-flight requests for request deduplication/coalescing
  private readonly inFlightRequests = new Map<string, Promise<ResolvedMedia>>();

  // Mutex queue to pace outgoing upstream requests respecting rate limits
  private lastUpstreamCallTime = 0;
  private readonly MIN_UPSTREAM_INTERVAL_MS = 1500; // 1.5s between upstream calls

  private getTimeoutMs(): number {
    const val = Number(process.env.FACEBOOK_PROVIDER_TIMEOUT_MS);
    return !isNaN(val) && val > 0 ? val : 15000;
  }

  public canHandle(url: URL): boolean {
    const host = url.hostname.toLowerCase();
    const isFacebookHost =
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.watch' ||
      host === 'fb.com';

    if (!isFacebookHost) return false;

    const pathname = url.pathname;
    return (
      /\/watch/i.test(pathname) ||
      /\/reel\/[A-Za-z0-9_-]+/i.test(pathname) ||
      /\/reels\/[A-Za-z0-9_-]+/i.test(pathname) ||
      /\/videos\//i.test(pathname) ||
      /\/posts\//i.test(pathname) ||
      /\/share\/(?:v|r)\/[A-Za-z0-9_-]+/i.test(pathname) ||
      (host === 'fb.watch' && pathname.length > 1)
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
   * Pure algorithmic decoder for SnapSave obfuscated responses
   */
  private static decodeSnapApp(args: string[]): string {
    const [h, , n, t, e] = args;
    const tNum = Number(t);
    const eNum = Number(e);

    function decode(d: string, eVal: number, fVal: number): string {
      const g = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/'.split('');
      const hArr = g.slice(0, eVal);
      const iArr = g.slice(0, fVal);
      const j = d.split('').reverse().reduce((a, b, c) => {
        const idx = hArr.indexOf(b);
        if (idx !== -1) return a + idx * Math.pow(eVal, c);
        return a;
      }, 0);
      let k = '';
      let tempJ = j;
      while (tempJ > 0) {
        k = iArr[tempJ % fVal] + k;
        tempJ = Math.floor(tempJ / fVal);
      }
      return k || '0';
    }

    let result = '';
    for (let i = 0, len = h.length; i < len; ) {
      let s = '';
      while (i < len && h[i] !== n[eNum]) {
        s += h[i];
        i++;
      }
      i++;
      for (let j = 0; j < n.length; j++) {
        s = s.replace(new RegExp(n[j], 'g'), j.toString());
      }
      result += String.fromCharCode(Number(decode(s, eNum, 10)) - tNum);
    }

    const bytes = new Uint8Array(result.split('').map((char) => char.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes);
  }

  private static decryptSnapSave(data: string): string {
    const match = data.split('decodeURIComponent(escape(r))}(')[1];
    if (!match) {
      throw new DownloaderAppError(
        'RESOLUTION_FAILED',
        'Unexpected response format from Facebook resolution engine.',
        502
      );
    }
    const inner = match.split('))')[0].split(',').map((v) => v.replace(/"/g, '').trim());
    return FacebookProvider.decodeSnapApp(inner);
  }

  /**
   * Executes Facebook media resolution with pacing and exponential backoff
   */
  private async executeResolutionWithPacing(url: URL): Promise<ResolvedMedia> {
    const targetUrl = url.toString();
    const maxRetries = 3;
    let attempt = 0;

    // Extract ID candidate from path or query
    const id = this.extractMediaId(url);

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
        res = await fetch('https://snapsave.app/action.php?lang=en', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Origin: 'https://snapsave.app',
            Referer: 'https://snapsave.app/',
          },
          body: new URLSearchParams({ url: targetUrl }).toString(),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (
          (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) ||
          String(err).includes('aborted') ||
          String(err).includes('timeout')
        ) {
          throw new DownloaderAppError(
            'TIMEOUT',
            `Facebook media resolution timed out after ${timeoutMs}ms while contacting upstream provider.`,
            504
          );
        }
        throw new DownloaderAppError(
          'UPSTREAM_ERROR',
          `Network error contacting Facebook resolver: ${err instanceof Error ? err.message : String(err)}`,
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
          'Facebook resolver rate limit reached. Please wait a moment before trying again.',
          429
        );
      }

      if (!res.ok) {
        throw new DownloaderAppError(
          'UPSTREAM_ERROR',
          `Facebook resolver returned HTTP status ${res.status}.`,
          res.status >= 500 ? 502 : 400
        );
      }

      let responseText: string;
      try {
        responseText = await res.text();
      } catch (err: unknown) {
        throw new DownloaderAppError(
          'UPSTREAM_ERROR',
          `Failed to read response from Facebook resolver: ${err instanceof Error ? err.message : String(err)}`,
          502
        );
      }

      // Check if response text is empty or too short
      if (!responseText || responseText.length < 50) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'The requested Facebook video could not be found or has been deleted.',
          404
        );
      }

      // Decode obfuscated payload
      let decodedScript: string;
      try {
        decodedScript = FacebookProvider.decryptSnapSave(responseText);
      } catch (err: unknown) {
        if (err instanceof DownloaderAppError) throw err;
        throw new DownloaderAppError(
          'RESOLUTION_FAILED',
          `Failed to decode Facebook media response: ${err instanceof Error ? err.message : String(err)}`,
          502
        );
      }

      // Check for upstream error messages inside decoded HTML
      if (
        decodedScript.includes('error_video_private') ||
        decodedScript.includes('The video is private') ||
        decodedScript.includes('Private Video')
      ) {
        throw new DownloaderAppError(
          'PRIVATE_MEDIA',
          'This Facebook media is not publicly accessible.',
          403
        );
      }

      const alertMatch = decodedScript.match(/document\.querySelector\("#alert"\)\.innerHTML\s*=\s*"([^"]+)"/);
      if (alertMatch && alertMatch[1]) {
        const alertText = alertMatch[1].replace(/<[^>]+>/g, '').trim();
        if (
          alertText.toLowerCase().includes('private') ||
          alertText.toLowerCase().includes('login')
        ) {
          throw new DownloaderAppError(
            'PRIVATE_MEDIA',
            'This Facebook media is not publicly accessible.',
            403
          );
        }
        if (
          alertText.toLowerCase().includes('not found') ||
          alertText.toLowerCase().includes('deleted') ||
          alertText.toLowerCase().includes('invalid')
        ) {
          throw new DownloaderAppError(
            'MEDIA_NOT_FOUND',
            'The requested Facebook video could not be found or has been deleted.',
            404
          );
        }
      }

      // Extract download section HTML
      const sectionMatch = decodedScript.split('getElementById("download-section").innerHTML = "')[1];
      if (!sectionMatch) {
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'No downloadable media streams found for this Facebook video.',
          404
        );
      }

      const sectionHtml = sectionMatch.split('"; document.getElementById("inputData").remove();')[0].replace(/\\(\\)?/g, '');

      // Parse metadata
      const desMatch = sectionHtml.match(/<span class="video-des">([^<]+)<\/span>/);
      const title = desMatch && desMatch[1].trim() && desMatch[1].trim() !== '...'
        ? desMatch[1].trim()
        : `Facebook Video (${id})`;

      const thumbMatch = sectionHtml.match(/<img src="([^"]+)"/);
      let thumbnailUrl: string | undefined;
      if (thumbMatch && thumbMatch[1].startsWith('http')) {
        try {
          const validatedThumb = SecurityValidator.validateMediaStreamUrl(thumbMatch[1]);
          thumbnailUrl = validatedThumb.toString();
        } catch {
          // Ignore invalid thumbnail URL
        }
      }

      // Extract table section strictly for video variants
      const tableMatch = sectionHtml.match(/<table[\s\S]*?<\/table>/);
      const tableHtml = tableMatch ? tableMatch[0] : '';
      if (!tableHtml) {
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'No video download streams found for this Facebook media.',
          404
        );
      }

      // Extract variants from table rows and tokens
      const variants: MediaVariant[] = [];
      const seenUrls = new Set<string>();

      // Extract JWT tokens strictly inside the table
      const tokenMatches = [...tableHtml.matchAll(/token=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g)].map((m) => m[1]);

      // Extract table rows for quality mapping
      const rowMatches = [...tableHtml.matchAll(/<tr>(.*?)<\/tr>/gs)];
      const qualityMap = new Map<number, string>();
      rowMatches.forEach((rowMatch, idx) => {
        const qMatch = rowMatch[1].match(/<td class="video-quality">([^<]+)<\/td>/);
        if (qMatch) {
          qualityMap.set(idx, qMatch[1].trim());
        }
      });

      let variantIndex = 1;
      for (let i = 0; i < tokenMatches.length; i++) {
        const token = tokenMatches[i];
        let payload: any = null;
        try {
          payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        } catch {
          continue;
        }

        if (!payload) continue;

        // Skip image payloads
        if (payload.url && /\.(jpe?g|png|webp)($|\?)/i.test(payload.url)) {
          continue;
        }

        const candidateUrl = payload.url || payload.video_url || `https://d.rapidcdn.app/v2?token=${token}&dl=1`;
        if (!candidateUrl || seenUrls.has(candidateUrl)) {
          continue;
        }

        // Validate security boundary on candidate stream URL
        try {
          const validated = SecurityValidator.validateMediaStreamUrl(candidateUrl);
          seenUrls.add(candidateUrl);

          const qualityLabel = qualityMap.get(i) || (payload.filename?.includes('hd') ? '720p (HD)' : '360p (SD)');
          variants.push({
            id: `facebook-video-${variantIndex++}`,
            url: validated.toString(),
            format: 'mp4',
            mimeType: 'video/mp4',
            quality: qualityLabel,
            hasWatermark: false,
          });
        } catch {
          // If URL validation fails SSRF or CDN check, skip this variant safely
          continue;
        }
      }

      if (variants.length === 0) {
        throw new DownloaderAppError(
          'MEDIA_NOT_FOUND',
          'Could not resolve any playable video streams for this Facebook video.',
          404
        );
      }

      const resolved: ResolvedMedia = {
        id,
        platform: 'facebook',
        sourceUrl: url.toString(),
        normalizedUrl: targetUrl,
        title,
        thumbnailUrl,
        mediaType: 'video',
        variants,
        resolvedAt: new Date().toISOString(),
      };

      return resolved;
    }

    throw new DownloaderAppError(
      'RESOLUTION_FAILED',
      'Failed to resolve Facebook media after maximum retries.',
      502
    );
  }

  /**
   * Extracts Facebook media ID from URL
   */
  private extractMediaId(url: URL): string {
    // 1. Query param 'v' (e.g. /watch/?v=1481060365360701)
    const vParam = url.searchParams.get('v');
    if (vParam) return vParam;

    // 2. /reel/{id} or /reels/{id}
    const reelMatch = url.pathname.match(/\/(?:reel|reels)\/([A-Za-z0-9_-]+)/);
    if (reelMatch) return reelMatch[1];

    // 3. /videos/{id}
    const videoMatch = url.pathname.match(/\/videos\/(?:[^\/]+\/)?([0-9]+)/);
    if (videoMatch) return videoMatch[1];

    // 4. /share/v/{id} or /share/r/{id}
    const shareMatch = url.pathname.match(/\/share\/(?:v|r)\/([A-Za-z0-9_-]+)/);
    if (shareMatch) return shareMatch[1];

    // 5. fb.watch/{id}
    if (url.hostname.toLowerCase() === 'fb.watch') {
      const fbWatchId = url.pathname.replace(/^\//, '').split('/')[0];
      if (fbWatchId) return fbWatchId;
    }

    // Fallback: sanitized pathname
    const fallbackId = url.pathname.replace(/[^A-Za-z0-9_-]/g, '_').slice(-20);
    return fallbackId || 'fb_media';
  }
}

import { PlatformId } from './types.js';
import { SecurityValidator } from './SecurityValidator.js';

export interface DetectionResult {
  platform: PlatformId;
  normalizedUrl: string;
  originalUrl: string;
  isSupportedMediaUrl: boolean;
  reason?: string;
}

export class PlatformDetector {
  // Tracking query parameters that should be stripped
  private static readonly TRACKING_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'igsh',
    'si',
    '_r',
    '_d',
    'is_from_webapp',
    'sender_device',
    'sender_web_id',
    'checksum',
    'ref',
    'ref_src',
    'ref_url',
    't',
    's',
    'twclid',
    'sfnsn',
    'mibextid',
    'rdid',
    'feature',
    'nic_v3',
    'invite_code',
    'sender',
    'invite_id',
  ]);

  /**
   * Normalize input URL by removing tracking params, trailing slashes, etc.
   */
  public static normalizeUrl(rawUrl: string): { url: URL; normalizedString: string } {
    const url = SecurityValidator.validateSubmittedUrl(rawUrl);

    // Filter tracking params
    const keysToDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (
        PlatformDetector.TRACKING_PARAMS.has(key.toLowerCase()) ||
        key.toLowerCase().startsWith('utm_')
      ) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      url.searchParams.delete(key);
    }

    // Clean pathname
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    url.pathname = pathname;

    // Remove hash
    url.hash = '';

    return {
      url,
      normalizedString: url.toString(),
    };
  }

  /**
   * Detects the target platform from a URL
   */
  public static detect(rawUrl: string): DetectionResult {
    const { url, normalizedString } = this.normalizeUrl(rawUrl);
    const host = url.hostname.toLowerCase();

    // 1. TikTok
    if (
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com') ||
      host === 'vm.tiktok.com' ||
      host === 'vt.tiktok.com'
    ) {
      const isVideoPattern =
        /\/video\/\d+/i.test(url.pathname) ||
        /\/v\/\d+/i.test(url.pathname) ||
        host === 'vm.tiktok.com' ||
        host === 'vt.tiktok.com' ||
        /\/@[^/]+\/video\/\d+/i.test(url.pathname);

      return {
        platform: 'tiktok',
        normalizedUrl: normalizedString,
        originalUrl: rawUrl,
        isSupportedMediaUrl: isVideoPattern,
        reason: isVideoPattern
          ? undefined
          : 'URL does not point to a specific TikTok video post (e.g. /@username/video/1234567890).',
      };
    }

    // 2. Instagram
    if (
      host === 'instagram.com' ||
      host.endsWith('.instagram.com') ||
      host === 'instagr.am'
    ) {
      const isMediaPattern =
        /\/p\/[^/]+/i.test(url.pathname) ||
        /\/reel\/[^/]+/i.test(url.pathname) ||
        /\/reels\/[^/]+/i.test(url.pathname) ||
        /\/tv\/[^/]+/i.test(url.pathname);

      return {
        platform: 'instagram',
        normalizedUrl: normalizedString,
        originalUrl: rawUrl,
        isSupportedMediaUrl: isMediaPattern,
        reason: isMediaPattern
          ? undefined
          : 'URL does not point to an Instagram Post or Reel (/p/ or /reel/).',
      };
    }

    // 3. Facebook
    if (
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.watch' ||
      host === 'fb.com'
    ) {
      const isMediaPattern =
        /\/watch/i.test(url.pathname) ||
        /\/reel\/[A-Za-z0-9_-]+/i.test(url.pathname) ||
        /\/reels\/[A-Za-z0-9_-]+/i.test(url.pathname) ||
        /\/videos\//i.test(url.pathname) ||
        /\/posts\//i.test(url.pathname) ||
        /\/share\/(?:v|r)\/[A-Za-z0-9_-]+/i.test(url.pathname) ||
        (host === 'fb.watch' && url.pathname.length > 1);

      return {
        platform: 'facebook',
        normalizedUrl: normalizedString,
        originalUrl: rawUrl,
        isSupportedMediaUrl: isMediaPattern,
        reason: isMediaPattern
          ? undefined
          : 'URL does not match a Facebook video or reel format (e.g. /watch, /reel, /videos/, /share/v/).',
      };
    }

    // 4. YouTube
    if (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be'
    ) {
      const hasWatchV = /\/watch/i.test(url.pathname) && Boolean(url.searchParams.get('v'));
      const hasShorts = /\/shorts\/[A-Za-z0-9_-]+/i.test(url.pathname);
      const hasYoutuBe = host === 'youtu.be' && /^\/[A-Za-z0-9_-]+$/.test(url.pathname);
      const isMediaPattern = hasYoutuBe || hasWatchV || hasShorts;

      return {
        platform: 'youtube',
        normalizedUrl: normalizedString,
        originalUrl: rawUrl,
        isSupportedMediaUrl: isMediaPattern,
        reason: isMediaPattern
          ? undefined
          : 'URL does not match a YouTube video or short format (e.g. /shorts/id, /watch?v=id, youtu.be/id).',
      };
    }

    // 5. X / Twitter
    if (
      host === 'twitter.com' ||
      host.endsWith('.twitter.com') ||
      host === 'x.com' ||
      host.endsWith('.x.com')
    ) {
      const isMediaPattern = /\/status\/\d+/i.test(url.pathname);

      return {
        platform: 'twitter',
        normalizedUrl: normalizedString,
        originalUrl: rawUrl,
        isSupportedMediaUrl: isMediaPattern,
        reason: isMediaPattern
          ? undefined
          : 'URL does not match an X/Twitter post status (/status/id).',
      };
    }

    // 6. Pinterest
    if (
      host === 'pinterest.com' ||
      host.endsWith('.pinterest.com') ||
      host === 'pin.it'
    ) {
      const isMediaPattern =
        host === 'pin.it' || /\/pin\/\d+/i.test(url.pathname);

      return {
        platform: 'pinterest',
        normalizedUrl: normalizedString,
        originalUrl: rawUrl,
        isSupportedMediaUrl: isMediaPattern,
        reason: isMediaPattern
          ? undefined
          : 'URL does not point to a specific Pinterest pin.',
      };
    }

    return {
      platform: 'unknown',
      normalizedUrl: normalizedString,
      originalUrl: rawUrl,
      isSupportedMediaUrl: false,
      reason: 'Domain is not a recognized supported social media platform.',
    };
  }
}

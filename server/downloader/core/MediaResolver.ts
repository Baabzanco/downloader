import { MediaProvider } from '../providers/BaseProvider.js';
import { TikTokProvider } from '../providers/tiktok/TikTokProvider.js';
import { InstagramProvider } from '../providers/instagram/InstagramProvider.js';
import { FacebookProvider } from '../providers/facebook/FacebookProvider.js';
import { YouTubeProvider } from '../providers/youtube/YouTubeProvider.js';
import { TwitterProvider } from '../providers/twitter/TwitterProvider.js';
import { PinterestProvider } from '../providers/pinterest/PinterestProvider.js';
import { PlatformId, ResolvedMedia } from './types.js';
import { DownloaderAppError } from './errors.js';
import { PlatformDetector } from './PlatformDetector.js';

export class MediaResolver {
  private readonly providers: Map<PlatformId, MediaProvider> = new Map();

  constructor() {
    this.registerProvider(new TikTokProvider());
    this.registerProvider(new InstagramProvider());
    this.registerProvider(new FacebookProvider());
    this.registerProvider(new YouTubeProvider());
    this.registerProvider(new TwitterProvider());
    this.registerProvider(new PinterestProvider());
  }

  public registerProvider(provider: MediaProvider): void {
    this.providers.set(provider.platform, provider);
  }

  public getProvider(platform: PlatformId): MediaProvider | undefined {
    return this.providers.get(platform);
  }

  public async resolveUrl(rawUrl: string): Promise<ResolvedMedia> {
    const detection = PlatformDetector.detect(rawUrl);

    if (detection.platform === 'unknown') {
      throw new DownloaderAppError(
        'UNSUPPORTED_PLATFORM',
        'Unsupported platform. Please provide a valid media URL from a supported service (e.g. TikTok).',
        400
      );
    }

    if (!detection.isSupportedMediaUrl) {
      throw new DownloaderAppError(
        'INVALID_URL',
        detection.reason || 'The provided URL does not point to a supported media item.',
        400
      );
    }

    const provider = this.providers.get(detection.platform);
    if (!provider) {
      throw new DownloaderAppError(
        'UNSUPPORTED_PLATFORM',
        `No resolution provider found for platform: ${detection.platform}`,
        400
      );
    }

    const targetUrl = new URL(detection.normalizedUrl);
    const media = await provider.resolve(targetUrl);
    return media;
  }
}

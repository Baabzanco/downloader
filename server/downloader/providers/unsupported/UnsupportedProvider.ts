import { MediaProvider } from '../BaseProvider.js';
import { PlatformId, ResolvedMedia } from '../../core/types.js';
import { DownloaderAppError } from '../../core/errors.js';

export class UnsupportedProvider implements MediaProvider {
  constructor(
    public readonly platform: PlatformId,
    public readonly name: string
  ) {}

  public readonly isEnabled = false;

  public canHandle(): boolean {
    return true;
  }

  public async resolve(url: URL): Promise<ResolvedMedia> {
    throw new DownloaderAppError(
      'UNSUPPORTED_PLATFORM',
      `${this.name} resolution is not supported in Phase 1 engine. Phase 1 currently supports real TikTok resolution. More platforms will be enabled in subsequent phases.`,
      400,
      { platform: this.platform, requestedUrl: url.toString() }
    );
  }
}

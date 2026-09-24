import { PlatformId, ResolvedMedia } from '../core/types.js';

export interface MediaProvider {
  readonly platform: PlatformId;
  readonly name: string;
  readonly isEnabled: boolean;

  canHandle(url: URL): boolean;

  resolve(url: URL): Promise<ResolvedMedia>;
}

import { Response } from 'express';
import { ResolvedMedia, MediaVariant } from './types.js';
import { DownloaderAppError } from './errors.js';
import { SecurityValidator } from './SecurityValidator.js';
import crypto from 'crypto';

interface CachedDownloadSession {
  token: string;
  media: ResolvedMedia;
  createdAt: number;
  expiresAt: number;
}

export class DownloadManager {
  private readonly sessions: Map<string, CachedDownloadSession> = new Map();
  private activeDownloadsCount = 0;

  private getSessionTtlMs(): number {
    const val = Number(process.env.DOWNLOAD_SESSION_TTL_MS);
    return !isNaN(val) && val > 0 ? val : 15 * 60 * 1000; // 15 minutes default
  }

  private getMaxDownloadSizeBytes(): number {
    const val = Number(process.env.MAX_DOWNLOAD_SIZE_BYTES);
    return !isNaN(val) && val > 0 ? val : 250 * 1024 * 1024; // 250 MB default
  }

  private getMaxConcurrentDownloads(): number {
    const val = Number(process.env.MAX_CONCURRENT_DOWNLOADS);
    return !isNaN(val) && val > 0 ? val : 10;
  }

  constructor() {
    // Garbage collection of expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000).unref();
  }

  /**
   * Generates a secure, cryptographically random 256-bit token for downloading resolved media
   */
  public createSession(media: ResolvedMedia): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const ttl = this.getSessionTtlMs();
    this.sessions.set(token, {
      token,
      media,
      createdAt: now,
      expiresAt: now + ttl,
    });
    return token;
  }

  public getSession(token: string): CachedDownloadSession | undefined {
    const session = this.sessions.get(token);
    if (!session) return undefined;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return undefined;
    }
    return session;
  }

  public getActiveDownloadsCount(): number {
    return this.activeDownloadsCount;
  }

  /**
   * Stream media variant directly to client response with concurrency control and size protection
   */
  public async streamMediaVariant(
    token: string,
    variantId: string,
    res: Response
  ): Promise<{ bytesStreamed: number; variant: MediaVariant }> {
    // Check concurrency limit
    const maxConcurrent = this.getMaxConcurrentDownloads();
    if (this.activeDownloadsCount >= maxConcurrent) {
      throw new DownloaderAppError(
        'RATE_LIMITED',
        'Server is currently at maximum concurrent download capacity. Please retry shortly.',
        429
      );
    }

    const session = this.getSession(token);
    if (!session) {
      throw new DownloaderAppError(
        'DOWNLOAD_FAILED',
        'Download session token has expired or is invalid. Please resolve the media URL again.',
        404
      );
    }

    const variant = session.media.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new DownloaderAppError(
        'DOWNLOAD_FAILED',
        `Media variant "${variantId}" not found for this media session.`,
        404
      );
    }

    // SSRF & CDN verification on upstream stream URL
    const targetUrl = SecurityValidator.validateMediaStreamUrl(variant.url);

    // Prepare clean sanitized filename
    const safeTitle = SecurityValidator.sanitizeFilename(
      session.media.title || `media_${session.media.id}`
    );
    const extension = variant.format || (variant.mimeType.includes('audio') ? 'mp3' : 'mp4');
    const filename = `${safeTitle}.${extension}`;

    const controller = new AbortController();
    let aborted = false;

    // Detect client disconnection
    res.on('close', () => {
      if (!res.writableEnded) {
        aborted = true;
        controller.abort();
      }
    });

    this.activeDownloadsCount++;

    try {
      let upstreamRes: globalThis.Response;
      try {
        let currentUrl = targetUrl;
        let hops = 0;
        const MAX_REDIRECT_HOPS = 5;

        while (true) {
          // Validate current URL hop asynchronously (protocol, allowlist, SSRF, DNS rebinding)
          await SecurityValidator.validateMediaStreamUrlAsync(currentUrl.toString());

          const res = await fetch(currentUrl.toString(), {
            method: 'GET',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: '*/*',
              Referer: session.media.sourceUrl,
            },
            redirect: 'manual',
            signal: controller.signal,
          });

          // Check if response is a redirect (301, 302, 303, 307, 308)
          if ([301, 302, 303, 307, 308].includes(res.status)) {
            hops++;
            if (hops > MAX_REDIRECT_HOPS) {
              throw new DownloaderAppError('DOWNLOAD_FAILED', 'Too many redirect hops while accessing media stream.', 502);
            }
            const location = res.headers.get('location');
            if (!location) {
              throw new DownloaderAppError('DOWNLOAD_FAILED', 'Redirect location header missing from upstream response.', 502);
            }

            // Resolve next URL relative to currentUrl
            const nextUrl = new URL(location, currentUrl);
            // Immediately validate the new redirect target against SecurityValidator
            await SecurityValidator.validateMediaStreamUrlAsync(nextUrl.toString());
            currentUrl = nextUrl;
            continue;
          }

          upstreamRes = res;
          break;
        }
      } catch (err: unknown) {
        if (aborted) {
          throw new DownloaderAppError('DOWNLOAD_FAILED', 'Client disconnected during download initiation.', 499);
        }
        if (err instanceof DownloaderAppError) {
          throw err;
        }
        throw new DownloaderAppError(
          'DOWNLOAD_FAILED',
          `Failed to connect to upstream media stream: ${err instanceof Error ? err.message : String(err)}`,
          502
        );
      }

      if (!upstreamRes.ok || !upstreamRes.body) {
        throw new DownloaderAppError(
          'DOWNLOAD_FAILED',
          `Upstream media stream returned HTTP status ${upstreamRes.status}.`,
          upstreamRes.status === 404 ? 404 : 502
        );
      }

      const maxSize = this.getMaxDownloadSizeBytes();
      const contentLengthHeader = upstreamRes.headers.get('content-length');
      const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : undefined;
      if (contentLength && contentLength > maxSize) {
        throw new DownloaderAppError(
          'FILE_TOO_LARGE',
          `Media file size (${Math.round(contentLength / 1024 / 1024)}MB) exceeds server limit of ${Math.round(maxSize / 1024 / 1024)}MB.`,
          413
        );
      }

      const contentType =
        upstreamRes.headers.get('content-type') || variant.mimeType || 'application/octet-stream';
      const lowerCt = contentType.toLowerCase();
      if (
        lowerCt.includes('text/html') ||
        lowerCt.includes('application/json') ||
        lowerCt.includes('text/plain') ||
        lowerCt.includes('text/xml') ||
        lowerCt.includes('application/xml')
      ) {
        throw new DownloaderAppError(
          'DOWNLOAD_FAILED',
          `Upstream returned invalid content-type for binary media (${contentType}).`,
          502
        );
      }

      // Stream chunks with initial chunk magic-byte validation
      const reader = upstreamRes.body.getReader();

      // Accumulate at least 128 bytes (or until EOF) to reliably inspect container headers
      let firstBuf = Buffer.alloc(0);
      let streamEndedEarly = false;
      while (firstBuf.length < 128) {
        const { done, value } = await reader.read();
        if (done) {
          if (value && value.length > 0) {
            firstBuf = Buffer.concat([firstBuf, Buffer.from(value)]);
          }
          streamEndedEarly = true;
          break;
        }
        if (value && value.length > 0) {
          firstBuf = Buffer.concat([firstBuf, Buffer.from(value)]);
        }
      }

      if (firstBuf.length === 0) {
        throw new DownloaderAppError(
          'DOWNLOAD_FAILED',
          'Upstream media stream returned an empty response body.',
          502
        );
      }

      // Inspect first chunk for textual / HTML / XML / JSON error payload masquerading as binary
      const headSample = firstBuf.subarray(0, Math.min(256, firstBuf.length)).toString('utf-8').trim();
      const lowerHead = headSample.toLowerCase();
      if (
        lowerHead.startsWith('<!doctype') ||
        lowerHead.startsWith('<html') ||
        lowerHead.startsWith('<?xml') ||
        lowerHead.startsWith('{"') ||
        lowerHead.startsWith('[{"') ||
        lowerHead.startsWith('{"error"') ||
        lowerHead.startsWith('{"status"')
      ) {
        throw new DownloaderAppError(
          'DOWNLOAD_FAILED',
          'Upstream returned text/HTML error payload instead of valid media binary.',
          502
        );
      }

      // Inspect magic bytes for container integrity
      if (extension === 'mp4' || variant.mimeType === 'video/mp4') {
        const hasFtypDirect = firstBuf.length >= 8 && (
          firstBuf.subarray(4, 8).toString('latin1') === 'ftyp' ||
          firstBuf.subarray(4, 8).toString('latin1') === 'moov' ||
          firstBuf.subarray(4, 8).toString('latin1') === 'mdat'
        );
        const hasFtypNearby = firstBuf.subarray(0, Math.min(64, firstBuf.length)).includes(Buffer.from('ftyp'));
        if (!hasFtypDirect && !hasFtypNearby) {
          throw new DownloaderAppError(
            'DOWNLOAD_FAILED',
            'Upstream stream does not conform to MP4 container signature (missing ftyp magic box).',
            502
          );
        }
      } else if (extension === 'webm' || variant.mimeType.includes('webm')) {
        const isWebM = firstBuf.length >= 4 &&
          firstBuf[0] === 0x1a && firstBuf[1] === 0x45 && firstBuf[2] === 0xdf && firstBuf[3] === 0xa3;
        if (!isWebM) {
          throw new DownloaderAppError(
            'DOWNLOAD_FAILED',
            'Upstream stream does not conform to WebM container signature.',
            502
          );
        }
      } else if (extension === 'mp3' || variant.mimeType.includes('mpeg') || variant.mimeType.includes('audio/mp3')) {
        const hasId3 = firstBuf.length >= 3 && firstBuf.subarray(0, 3).toString('latin1') === 'ID3';
        const hasSync = firstBuf.length >= 2 && firstBuf[0] === 0xff && (firstBuf[1] & 0xe0) === 0xe0;
        if (!hasId3 && !hasSync) {
          throw new DownloaderAppError(
            'DOWNLOAD_FAILED',
            'Upstream stream does not conform to MP3 audio signature.',
            502
          );
        }
      }

      // Set verified download headers on Express response
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength.toString());
      }
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      let totalBytes = firstBuf.length;
      const initialWriteOk = res.write(firstBuf);
      if (!initialWriteOk) {
        await new Promise<void>((resolve) => res.once('drain', resolve));
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          totalBytes += value.length;
          if (totalBytes > maxSize) {
            controller.abort();
            throw new DownloaderAppError(
              'FILE_TOO_LARGE',
              `Download exceeded limit of ${Math.round(maxSize / 1024 / 1024)}MB during transfer.`,
              413
            );
          }

          const ok = res.write(Buffer.from(value));
          if (!ok) {
            await new Promise<void>((resolve) => res.once('drain', resolve));
          }
        }
        res.end();
      } catch (err: unknown) {
        if (aborted) {
          return { bytesStreamed: totalBytes, variant };
        }
        if (!res.headersSent) {
          throw err;
        }
        res.destroy();
        throw err;
      }

      return { bytesStreamed: totalBytes, variant };
    } finally {
      this.activeDownloadsCount = Math.max(0, this.activeDownloadsCount - 1);
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
      }
    }
  }
}

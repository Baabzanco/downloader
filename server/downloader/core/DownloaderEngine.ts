import { MediaResolver } from './MediaResolver.js';
import { DownloadManager } from './DownloadManager.js';
import { PlatformDetector } from './PlatformDetector.js';
import { RateLimiter } from './RateLimiter.js';
import {
  DiagnosticLogEntry,
  ResolvedMedia,
  ResolveApiResponse,
} from './types.js';
import { DownloaderAppError, isDownloaderAppError } from './errors.js';
import { Response } from 'express';

export class DownloaderEngine {
  private static instance: DownloaderEngine;

  public readonly resolver: MediaResolver;
  public readonly downloadManager: DownloadManager;
  public readonly rateLimiter: RateLimiter;
  private readonly diagnosticLogs: DiagnosticLogEntry[] = [];
  private readonly MAX_DIAGNOSTIC_LOGS = 100;
  private activeResolutionsCount = 0;

  private getMaxConcurrentResolutions(): number {
    const val = Number(process.env.MAX_CONCURRENT_RESOLUTIONS);
    return !isNaN(val) && val > 0 ? val : 15;
  }

  private constructor() {
    this.resolver = new MediaResolver();
    this.downloadManager = new DownloadManager();
    this.rateLimiter = new RateLimiter();
  }

  public static getInstance(): DownloaderEngine {
    if (!DownloaderEngine.instance) {
      DownloaderEngine.instance = new DownloaderEngine();
    }
    return DownloaderEngine.instance;
  }

  public addDiagnosticLog(entry: Omit<DiagnosticLogEntry, 'id' | 'timestamp'>): void {
    const fullEntry: DiagnosticLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.diagnosticLogs.unshift(fullEntry);
    if (this.diagnosticLogs.length > this.MAX_DIAGNOSTIC_LOGS) {
      this.diagnosticLogs.pop();
    }
  }

  public getDiagnosticLogs(): DiagnosticLogEntry[] {
    return [...this.diagnosticLogs];
  }

  /**
   * Complete resolution flow with rate limiting, concurrency cap, and sanitized responses
   */
  public async resolveMedia(
    rawUrl: string,
    clientIp: string = '127.0.0.1'
  ): Promise<ResolveApiResponse> {
    const startTime = Date.now();
    let detectedPlatform: any = 'unknown';

    const maxResolutions = this.getMaxConcurrentResolutions();
    if (this.activeResolutionsCount >= maxResolutions) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Server is at maximum resolution capacity. Please retry shortly.',
        },
      };
    }

    this.activeResolutionsCount++;

    try {
      this.rateLimiter.check(clientIp);

      const detection = PlatformDetector.detect(rawUrl);
      detectedPlatform = detection.platform;

      this.addDiagnosticLog({
        action: 'detect',
        platform: detection.platform,
        url: rawUrl,
        status: 'success',
        details: {
          normalizedUrl: detection.normalizedUrl,
          isSupportedMediaUrl: detection.isSupportedMediaUrl,
        },
      });

      this.addDiagnosticLog({
        action: 'resolve',
        platform: detection.platform,
        url: detection.normalizedUrl,
        status: 'started',
      });

      const media: ResolvedMedia = await this.resolver.resolveUrl(rawUrl);
      const downloadToken = this.downloadManager.createSession(media);

      this.addDiagnosticLog({
        action: 'resolve',
        platform: media.platform,
        url: media.normalizedUrl,
        status: 'success',
        durationMs: Date.now() - startTime,
        details: {
          title: media.title,
          author: media.author?.username,
          variantCount: media.variants.length,
          variants: media.variants.map((v) => ({
            id: v.id,
            quality: v.quality,
            format: v.format,
            sizeBytes: v.fileSize,
          })),
        },
      });

      return {
        success: true,
        media,
        downloadToken,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      let errorCode: any = 'INTERNAL_ERROR';
      let message = 'An unexpected internal error occurred.';
      let statusCode = 500;
      let details: unknown = undefined;

      if (isDownloaderAppError(err)) {
        errorCode = err.code;
        message = err.message;
        statusCode = err.statusCode;
        details = err.details;
      } else if (err instanceof Error) {
        // Sanitize unexpected error messages to prevent stack or path leakage
        message = err.message.replace(/(\/[a-zA-Z0-9._-]+)+/g, '[path]');
      }

      this.addDiagnosticLog({
        action: 'resolve',
        platform: detectedPlatform,
        url: rawUrl,
        status: 'failed',
        error: `[${errorCode}] ${message}`,
        durationMs,
        details: { statusCode, details },
      });

      return {
        success: false,
        error: {
          code: errorCode,
          message,
          details,
        },
      };
    } finally {
      this.activeResolutionsCount = Math.max(0, this.activeResolutionsCount - 1);
    }
  }

  /**
   * Proxied streaming download
   */
  public async streamDownload(
    token: string,
    variantId: string,
    res: Response,
    clientIp: string = '127.0.0.1'
  ): Promise<void> {
    const startTime = Date.now();
    try {
      this.rateLimiter.check(clientIp);

      this.addDiagnosticLog({
        action: 'download',
        status: 'started',
        details: { token: token ? `${token.slice(0, 8)}...` : undefined, variantId },
      });

      const result = await this.downloadManager.streamMediaVariant(token, variantId, res);

      this.addDiagnosticLog({
        action: 'download',
        status: 'success',
        durationMs: Date.now() - startTime,
        details: {
          variantId,
          bytesStreamed: result.bytesStreamed,
          quality: result.variant.quality,
        },
      });
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg =
        err instanceof Error
          ? err.message.replace(/(\/[a-zA-Z0-9._-]+)+/g, '[path]')
          : 'Stream download failed.';

      this.addDiagnosticLog({
        action: 'download',
        status: 'failed',
        error: errorMsg,
        durationMs,
        details: { token: token ? `${token.slice(0, 8)}...` : undefined, variantId },
      });

      if (!res.headersSent) {
        const statusCode = isDownloaderAppError(err) ? err.statusCode : 500;
        const code = isDownloaderAppError(err) ? err.code : 'DOWNLOAD_FAILED';
        res.status(statusCode).json({
          success: false,
          error: {
            code,
            message: errorMsg,
          },
        });
      }
    }
  }
}

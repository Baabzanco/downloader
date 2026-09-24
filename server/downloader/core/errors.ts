import { DownloaderErrorCode } from './types.js';

export class DownloaderAppError extends Error {
  public readonly code: DownloaderErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: DownloaderErrorCode,
    message: string,
    statusCode: number = 400,
    details?: unknown
  ) {
    super(message);
    this.name = 'DownloaderAppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isDownloaderAppError(error: unknown): error is DownloaderAppError {
  return error instanceof DownloaderAppError;
}

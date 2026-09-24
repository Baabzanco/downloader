import { DownloaderAppError } from './errors.js';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private readonly buckets: Map<string, RateLimitBucket> = new Map();
  private readonly maxTokens: number;
  private readonly refillRatePerSecond: number;

  constructor(
    maxTokens: number = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 40),
    windowSeconds: number = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60)
  ) {
    this.maxTokens = maxTokens;
    this.refillRatePerSecond = maxTokens / Math.max(1, windowSeconds);

    // Garbage collection of stale IPs
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  public check(ip: string): void {
    const now = Date.now();
    let bucket = this.buckets.get(ip);

    if (!bucket) {
      bucket = { tokens: this.maxTokens - 1, lastRefill: now };
      this.buckets.set(ip, bucket);
      return;
    }

    // Refill tokens based on elapsed time
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      this.maxTokens,
      bucket.tokens + elapsedSeconds * this.refillRatePerSecond
    );
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      throw new DownloaderAppError(
        'RATE_LIMITED',
        'Too many requests. Please wait a moment before trying again.',
        429
      );
    }

    bucket.tokens -= 1;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > 10 * 60 * 1000 && bucket.tokens >= this.maxTokens) {
        this.buckets.delete(ip);
      }
    }
  }
}

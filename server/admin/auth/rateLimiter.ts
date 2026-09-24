interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

export class LoginRateLimiter {
  private static attempts: Map<string, AttemptRecord> = new Map();
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

  public static isLocked(key: string): { locked: boolean; remainingSeconds?: number } {
    const record = this.attempts.get(key);
    if (!record) return { locked: false };

    const now = Date.now();
    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { locked: true, remainingSeconds };
    }

    // Clean up window expiry
    if (now - record.firstAttemptAt > this.WINDOW_MS) {
      this.attempts.delete(key);
      return { locked: false };
    }

    return { locked: false };
  }

  public static recordFailure(key: string): { locked: boolean; remainingAttempts: number } {
    const now = Date.now();
    let record = this.attempts.get(key);

    if (!record || now - record.firstAttemptAt > this.WINDOW_MS) {
      record = { count: 1, firstAttemptAt: now };
    } else {
      record.count += 1;
    }

    if (record.count >= this.MAX_ATTEMPTS) {
      record.lockedUntil = now + this.LOCKOUT_MS;
      this.attempts.set(key, record);
      return { locked: true, remainingAttempts: 0 };
    }

    this.attempts.set(key, record);
    return { locked: false, remainingAttempts: this.MAX_ATTEMPTS - record.count };
  }

  public static recordSuccess(key: string): void {
    this.attempts.delete(key);
  }

  public static reset(): void {
    this.attempts.clear();
  }
}

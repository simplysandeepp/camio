/**
 * Tiny in-memory rate limiter for login attempts.
 *
 * Good enough for a single self-hosted instance: caps brute-force attempts per
 * client IP. State is per-process (resets on restart), which is fine here.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

const buckets = new Map<string, Bucket>();

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkLoginRate(ip: string): RateResult {
  const now = Date.now();
  const b = buckets.get(ip);

  if (!b || now >= b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterSec: 0 };
  }

  if (b.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((b.resetAt - now) / 1000),
    };
  }

  b.count += 1;
  return { allowed: true, remaining: MAX_ATTEMPTS - b.count, retryAfterSec: 0 };
}

/** Called on a successful login to clear the client's failure count. */
export function resetLoginRate(ip: string): void {
  buckets.delete(ip);
}

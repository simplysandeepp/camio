/**
 * In-memory login rate limiter, keyed on the ACCOUNT (not a spoofable IP).
 *
 * Keying on the username means an attacker can't bypass the cap by rotating a
 * forged `X-Forwarded-For` header (the app has no trusted proxy by default).
 * The map is pruned and size-capped so forged keys can't exhaust memory.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;
const MAX_BUCKETS = 5000; // memory backstop against forged keys

const buckets = new Map<string, Bucket>();

function prune(now: number): void {
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
  if (buckets.size > MAX_BUCKETS) {
    // Drop the buckets closest to expiring first.
    const sorted = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < sorted.length - MAX_BUCKETS; i++) {
      buckets.delete(sorted[i][0]);
    }
  }
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkLoginRate(key: string): RateResult {
  const now = Date.now();
  prune(now);
  const b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
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

/** Called on a successful login to clear the account's failure count. */
export function resetLoginRate(key: string): void {
  buckets.delete(key);
}

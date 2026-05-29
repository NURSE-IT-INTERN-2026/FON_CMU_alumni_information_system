/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-instance deployments (standalone output).
 * For multi-instance or serverless, replace with a Redis-backed implementation.
 */

interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Returns true if the key is within limits, false if it should be blocked. */
export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
} {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterMs: 0 };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.attempts += 1;
  return {
    allowed: true,
    remaining: MAX_ATTEMPTS - entry.attempts,
    retryAfterMs: 0,
  };
}

/** Call on successful authentication to reset the counter for a key. */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

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
/** Hard cap on the number of tracked keys, so a spoofed-IP / high-cardinality
 * attack can't grow `store` without bound (memory). */
export const MAX_STORE_SIZE = 10_000;

/** Drop expired entries, and if still over the hard cap evict the
 * oldest-inserted (Map preserves insertion order). Bounds `store`. */
function prune(now: number): void {
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
  if (store.size > MAX_STORE_SIZE) {
    let toDelete = store.size - MAX_STORE_SIZE;
    for (const k of store.keys()) {
      store.delete(k);
      if (--toDelete <= 0) break;
    }
  }
}

/** Observable store size (tests / monitoring). */
export function rateLimitStoreSize(): number {
  return store.size;
}

/** Returns true if the key is within limits, false if it should be blocked. */
export function checkRateLimit(
  key: string,
  maxAttempts: number = MAX_ATTEMPTS,
  windowMs: number = WINDOW_MS,
): {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
} {
  const now = Date.now();
  // Probabilistically reclaim expired entries (~2% of calls) so the store
  // can't grow unboundedly with distinct keys.
  if (Math.random() < 0.02) {
    prune(now);
  }
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { attempts: 1, resetAt: now + windowMs });
    // Enforce the hard cap whenever a new key pushes the store over it.
    if (store.size > MAX_STORE_SIZE) {
      prune(now);
    }
    return { allowed: true, remaining: maxAttempts - 1, retryAfterMs: 0 };
  }

  if (entry.attempts >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.attempts += 1;
  return {
    allowed: true,
    remaining: maxAttempts - entry.attempts,
    retryAfterMs: 0,
  };
}

/** Call on successful authentication to reset the counter for a key. */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

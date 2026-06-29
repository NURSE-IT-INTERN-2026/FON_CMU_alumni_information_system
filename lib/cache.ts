/**
 * Process-level in-memory TTL cache (SERVER-ONLY — kept in `lib/` but never
 * imported from a client component; it holds arbitrary values, not Prisma).
 *
 * Exists to cut Prisma "operations" (a query-count quota) on read-heavy,
 * rarely-changing endpoints — primarily the dashboard / alumni-count
 * aggregations, which otherwise run ~17 queries on every page load. A 60s TTL
 * turns a burst of dashboard loads into one computation per minute.
 *
 * The store is a module-level `Map`, so it persists across requests only as
 * long as the Node process lives. The app ships as a long-lived server
 * (`output: "standalone"` Docker) — fine here; NOT serverless/edge-safe (a
 * new instance = a cold cache). Mirrors the existing module-level cache pattern
 * in `lib/cmu-registrar.ts`.
 *
 * No in-flight dedupe: a coincidental double-miss exactly at expiry may run
 * `fn` twice. Acceptable — the cached producers are idempotent reads. If you
 * ever need instant freshness after a write, call `bustCache("dashboard")`
 * (etc.) from the relevant write route.
 */

type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();

/**
 * Return the cached value for `key` if it's still fresh; otherwise run `fn`,
 * store its result with a `ttlMs` lifetime, and return it.
 */
export async function withTtlCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }
  const value = await fn();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Drop a single cache entry (call from a write route to force a refresh). */
export function bustCache(key: string): void {
  store.delete(key);
}

/** Drop every entry whose key starts with `prefix`. `bustCachePrefix("")` clears all. */
export function bustCachePrefix(prefix: string): void {
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

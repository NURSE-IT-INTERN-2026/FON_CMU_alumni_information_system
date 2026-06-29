import { describe, it, expect, vi, beforeEach } from "vitest";
import { withTtlCache, bustCache, bustCachePrefix } from "@/lib/cache";

// `bustCachePrefix("")` matches every key, so it clears the whole store.
beforeEach(() => {
  bustCachePrefix("");
});

describe("withTtlCache", () => {
  it("caches within the TTL — fn runs once for repeated reads", async () => {
    const fn = vi.fn(async () => ({ ok: true }));
    const a = await withTtlCache("k", 60_000, fn);
    const b = await withTtlCache("k", 60_000, fn);
    expect(a).toEqual({ ok: true });
    expect(b).toBe(a); // same cached object reference
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("re-runs fn after the TTL expires", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async (i: number) => i);
      await withTtlCache("k", 1_000, () => fn(1));
      vi.advanceTimersByTime(1_001);
      await withTtlCache("k", 1_000, () => fn(2));
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still serves the cached value just before expiry", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn(async () => "v");
      await withTtlCache("k", 1_000, fn);
      vi.advanceTimersByTime(1_000); // exactly at expiry boundary → considered stale
      await withTtlCache("k", 1_000, fn);
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("caches distinct keys independently", async () => {
    const fnA = vi.fn(async () => "a");
    const fnB = vi.fn(async () => "b");
    await withTtlCache("a", 60_000, fnA);
    await withTtlCache("b", 60_000, fnB);
    expect(await withTtlCache("a", 60_000, fnA)).toBe("a");
    expect(await withTtlCache("b", 60_000, fnB)).toBe("b");
    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
  });
});

describe("bustCache", () => {
  it("drops a single entry so the next read recomputes", async () => {
    const fn = vi.fn(async () => 1);
    await withTtlCache("k", 60_000, fn);
    bustCache("k");
    await withTtlCache("k", 60_000, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("is a no-op for an unknown key", async () => {
    const fn = vi.fn(async () => 1);
    await withTtlCache("k", 60_000, fn);
    bustCache("nope");
    await withTtlCache("k", 60_000, fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("bustCachePrefix", () => {
  it("drops only entries matching the prefix", async () => {
    const dash = vi.fn(async () => "d");
    const count = vi.fn(async () => "c");
    await withTtlCache("dashboard", 60_000, dash);
    await withTtlCache("alumni-count", 60_000, count);

    bustCachePrefix("alumni");
    // alumni-count recomputes, dashboard stays cached
    await withTtlCache("dashboard", 60_000, dash);
    await withTtlCache("alumni-count", 60_000, count);
    expect(dash).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(2);
  });

  it('clears everything with the empty prefix', async () => {
    const fn = vi.fn(async () => 1);
    await withTtlCache("anything", 60_000, fn);
    bustCachePrefix("");
    await withTtlCache("anything", 60_000, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

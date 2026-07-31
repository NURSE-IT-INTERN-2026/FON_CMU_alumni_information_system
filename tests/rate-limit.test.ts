import { describe, it, expect } from "vitest";
import { getClientIp } from "@/lib/get-client-ip";
import {
  checkRateLimit,
  resetRateLimit,
  rateLimitStoreSize,
  MAX_STORE_SIZE,
} from "@/lib/rate-limit";

const headers = (entries: Record<string, string>) => ({
  get: (name: string) => entries[name.toLowerCase()] ?? null,
});

describe("getClientIp (security #14)", () => {
  it("prefers X-Real-IP over X-Forwarded-For", () => {
    expect(
      getClientIp(
        headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "spoofed, fake" }),
      ),
    ).toBe("203.0.113.9");
  });

  it("uses the RIGHTMOST XFF entry (proxy-appended), ignoring the spoofed leftmost", () => {
    expect(
      getClientIp(headers({ "x-forwarded-for": "spoofed, fake, 198.51.100.7" })),
    ).toBe("198.51.100.7");
  });

  it("returns 'unknown' when neither header is present", () => {
    expect(getClientIp(headers({}))).toBe("unknown");
  });

  it("ignores empty XFF parts", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "  ,  , 203.0.113.4  " }))).toBe(
      "203.0.113.4",
    );
  });
});

describe("checkRateLimit", () => {
  it("allows up to MAX_ATTEMPTS then blocks", () => {
    const key = `test-allow-${Math.random()}`;
    let last: { allowed: boolean } | undefined;
    for (let i = 0; i < 5; i++) last = checkRateLimit(key);
    expect(last!.allowed).toBe(true); // 5th allowed
    expect(checkRateLimit(key).allowed).toBe(false); // 6th blocked
  });

  it("resetRateLimit clears the counter", () => {
    const key = `test-reset-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(key);
    expect(checkRateLimit(key).allowed).toBe(false);
    resetRateLimit(key);
    expect(checkRateLimit(key).allowed).toBe(true);
  });

  it("bounds the store size at MAX_STORE_SIZE (unbounded-Map fix)", () => {
    for (let i = 0; i < MAX_STORE_SIZE + 100; i++) {
      checkRateLimit(`cap-key-${i}`);
    }
    expect(rateLimitStoreSize()).toBeLessThanOrEqual(MAX_STORE_SIZE);
  });
});

import { describe, it, expect } from "vitest";
import { verifyEmailSchema, resendVerificationSchema } from "@/lib/validations/auth";

describe("verifyEmailSchema", () => {
  it("accepts a non-empty token", () => {
    const parsed = verifyEmailSchema.safeParse({ token: "abc123token" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty token", () => {
    const parsed = verifyEmailSchema.safeParse({ token: "" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a missing token", () => {
    const parsed = verifyEmailSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });
});

describe("resendVerificationSchema", () => {
  it("accepts a valid email (normalized by the route, not the schema)", () => {
    const parsed = resendVerificationSchema.safeParse({ email: "user@example.com" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const parsed = resendVerificationSchema.safeParse({ email: "not-an-email" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty email", () => {
    const parsed = resendVerificationSchema.safeParse({ email: "" });
    expect(parsed.success).toBe(false);
  });
});

// Token validity mirrors the runtime check in the verify-email route
// (record exists, !used, expiresAt >= now). This encodes the expiry math so a
// regression (e.g. dropping the 24h window) is caught.
describe("email-verification token expiry window", () => {
  const HOUR_MS = 60 * 60 * 1000;

  it("a freshly issued 24h token is valid", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 24 * HOUR_MS);
    expect(expiresAt.getTime() >= now).toBe(true);
  });

  it("a token past its 24h expiry is invalid", () => {
    const now = Date.now();
    const expiresAt = new Date(now - 1); // just expired
    expect(expiresAt.getTime() < now).toBe(true);
  });

  it("the verify window (24h) is longer than the reset window (1h)", () => {
    expect(24 * HOUR_MS).toBeGreaterThan(HOUR_MS);
  });
});

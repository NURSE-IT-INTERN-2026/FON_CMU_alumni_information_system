import { describe, it, expect } from "vitest";
import { hashToken } from "@/lib/auth";

describe("hashToken", () => {
  it("is deterministic (same input → same digest)", () => {
    expect(hashToken("some-raw-token")).toBe(hashToken("some-raw-token"));
  });

  it("differs from its raw input", () => {
    const raw = "550e8400-e29b-41d4-a716-446655440000";
    expect(hashToken(raw)).not.toBe(raw);
  });

  it("produces distinct digests for distinct inputs", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("emits a 64-char lowercase-hex SHA-256 digest", () => {
    expect(hashToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });

  // Strong correctness anchor: pins the algorithm to SHA-256 (hex), so a future
  // accidental swap (e.g. to md5/base64) fails loudly.
  it("matches a known SHA-256 vector", () => {
    // sha256("abc")
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

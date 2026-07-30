import { describe, it, expect } from "vitest";
import { constantTimeEqual } from "@/lib/auth";

describe("constantTimeEqual", () => {
  it("returns true for equal strings", () => {
    expect(constantTimeEqual("Bearer abc", "Bearer abc")).toBe(true);
  });

  it("returns false for same-length, different content", () => {
    expect(constantTimeEqual("Bearer abc", "Bearer abd")).toBe(false);
  });

  it("returns false for different lengths without throwing", () => {
    expect(constantTimeEqual("Bearer abc", "Bearer abcd")).toBe(false);
    expect(() => constantTimeEqual("short", "a-much-longer-string")).not.toThrow();
  });

  it("returns false when one side is null/undefined", () => {
    expect(constantTimeEqual(null, "Bearer abc")).toBe(false);
    expect(constantTimeEqual("Bearer abc", undefined)).toBe(false);
  });

  it("accepts a correct bearer secret and rejects a same-length imposter", () => {
    const secret = "x".repeat(24);
    expect(constantTimeEqual(`Bearer ${secret}`, `Bearer ${secret}`)).toBe(true);
    expect(constantTimeEqual(`Bearer ${"y".repeat(24)}`, `Bearer ${secret}`)).toBe(false);
  });
});

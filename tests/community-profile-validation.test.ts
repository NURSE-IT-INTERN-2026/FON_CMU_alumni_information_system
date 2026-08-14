import { describe, expect, it } from "vitest";
import { communityProfileSchema } from "@/lib/validations/community-profile";

describe("communityProfileSchema", () => {
  it("accepts an empty object (everything optional)", () => {
    expect(communityProfileSchema.parse({})).toEqual({});
  });

  it("accepts null values (clearing a field)", () => {
    const out = communityProfileSchema.parse({ bio: null, province: null });
    expect(out.bio).toBeNull();
    expect(out.province).toBeNull();
  });

  it("accepts an empty string for url/email fields (form clear)", () => {
    expect(communityProfileSchema.parse({ facebookUrl: "", contactEmail: "" })).toEqual({
      facebookUrl: "",
      contactEmail: "",
    });
  });

  it("rejects bio longer than 2,000 chars", () => {
    expect(
      communityProfileSchema.safeParse({ bio: "a".repeat(2001) }).success,
    ).toBe(false);
    expect(communityProfileSchema.safeParse({ bio: "a".repeat(2000) }).success).toBe(true);
  });

  it("rejects malformed URLs and emails", () => {
    expect(communityProfileSchema.safeParse({ facebookUrl: "not-a-url" }).success).toBe(false);
    expect(communityProfileSchema.safeParse({ linkedinUrl: "https://linkedin.com/in/x" }).success).toBe(true);
    expect(communityProfileSchema.safeParse({ contactEmail: "nope" }).success).toBe(false);
    expect(communityProfileSchema.safeParse({ contactEmail: "a@b.co" }).success).toBe(true);
  });

  it("lineId is plain text (no URL validation)", () => {
    expect(communityProfileSchema.safeParse({ lineId: "somchai.cmu" }).success).toBe(true);
  });

  it("ignores unknown keys (route only persists the fixed field list)", () => {
    const out = communityProfileSchema.parse({ id: "hacked", alumniId: "hacked", bio: "hi" });
    expect(out).not.toHaveProperty("id");
    expect(out).not.toHaveProperty("alumniId");
    expect(out.bio).toBe("hi");
  });
});

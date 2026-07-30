// @vitest-environment node
/**
 * Regression guard for award link/imageUrl data loss on profile edit (W2).
 *
 * Root cause: both profile-edit routes (admin update-with-related + alumni
 * self-edit) rebuilt awards via deleteMany + createMany, but the UPDATE zod
 * schema omitted `link`/`imageUrl` — so zod stripped them and createMany wrote
 * null on every save, silently deleting every award's link + photo. (The CREATE
 * schema already had them.)
 *
 * This asserts the server schemas now PRESERVE link/imageUrl so the routes
 * receive them. zod objects strip unknown keys by default, so before the fix
 * `parsed.awards[i].link` was undefined; now it round-trips.
 */
import { describe, expect, it } from "vitest";
import {
  alumniWithRelatedUpdateSchema,
  alumniProfileUpdateSchema,
} from "@/lib/validations/alumni-with-related";

const payloadWithAwardMedia = {
  prefix: "นาย",
  firstName: "ทดสอบ",
  lastName: "รางวัล",
  awards: [
    {
      awardName: "รางวัลแห่งชาติ",
      awardType: "NATIONAL",
      year: 2568,
      link: "https://example.com/a",
      imageUrl: "https://example.com/a.png",
      description: "รายละเอียด",
    },
  ],
};

describe("award link/imageUrl survive profile-edit validation (W2)", () => {
  it("alumniWithRelatedUpdateSchema keeps award link/imageUrl (admin edit)", () => {
    const parsed = alumniWithRelatedUpdateSchema.parse(payloadWithAwardMedia);
    expect(parsed.awards?.[0].link).toBe("https://example.com/a");
    expect(parsed.awards?.[0].imageUrl).toBe("https://example.com/a.png");
  });

  it("alumniProfileUpdateSchema keeps award link/imageUrl (alumni self-edit)", () => {
    const parsed = alumniProfileUpdateSchema.parse(payloadWithAwardMedia);
    expect(parsed.awards?.[0].link).toBe("https://example.com/a");
    expect(parsed.awards?.[0].imageUrl).toBe("https://example.com/a.png");
  });

  it("awards without link/imageUrl still parse (backward compatible)", () => {
    const parsed = alumniWithRelatedUpdateSchema.parse({
      ...payloadWithAwardMedia,
      awards: [{ awardName: "x", awardType: "LOCAL", year: 2568, description: "" }],
    });
    expect(parsed.awards?.[0]?.awardName).toBe("x");
  });
});

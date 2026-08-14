import { describe, expect, it } from "vitest";
import { normalizeCohortKey, cohortSlug } from "@/lib/group-cohort";

describe("normalizeCohortKey / cohortSlug", () => {
  it("collapses whitespace and trims (Thai labels kept verbatim)", () => {
    expect(normalizeCohortKey("  พยบ.   25 ")).toBe("พยบ. 25");
    expect(normalizeCohortKey("52")).toBe("52");
    expect(normalizeCohortKey("\t\n  \t")).toBe("");
  });

  it("slug prefixes with cohort- and keeps the normalized key", () => {
    expect(cohortSlug("พยบ. 25")).toBe("cohort-พยบ. 25");
    expect(cohortSlug(" 52 ")).toBe("cohort-52");
  });

  it("is stable (same label → same key/slug; no transliteration)", () => {
    expect(normalizeCohortKey("พยบ. 25")).toBe(normalizeCohortKey("พยบ.\t25"));
    expect(cohortSlug("พยบ. 25")).not.toContain("phb");
  });
});

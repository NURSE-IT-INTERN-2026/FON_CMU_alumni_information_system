import { describe, expect, it } from "vitest";
import {
  JOBS_DEFAULT_COUNTRY,
  isThailandFilter,
  jobCountryWhere,
} from "@/lib/job-country";
import { THAILAND_COUNTRY_VALUES } from "@/lib/alumni-agency-region";

describe("jobCountryWhere — jobs country filter fragment", () => {
  it("empty value means no filter", () => {
    expect(jobCountryWhere("")).toBeNull();
    expect(jobCountryWhere("   ")).toBeNull();
  });

  it("Thailand matches the known Thai spellings OR a null country (blank = domestic)", () => {
    for (const c of ["ประเทศไทย", "ไทย", "Thailand", "thai", " THAILAND "]) {
      expect(isThailandFilter(c)).toBe(true);
      expect(jobCountryWhere(c)).toEqual({
        OR: [
          { country: { in: [...THAILAND_COUNTRY_VALUES], mode: "insensitive" } },
          { country: null },
        ],
      });
    }
  });

  it("another country matches equals-insensitively (free-text data)", () => {
    expect(jobCountryWhere("สิงคโปร์")).toEqual({
      country: { equals: "สิงคโปร์", mode: "insensitive" },
    });
  });

  it("the default filter value is Thailand", () => {
    expect(JOBS_DEFAULT_COUNTRY).toBe("ประเทศไทย");
    expect(isThailandFilter(JOBS_DEFAULT_COUNTRY)).toBe(true);
  });
});

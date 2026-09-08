import type { Prisma } from "@/app/generated/prisma/client";
import { isThailandCountry, THAILAND_COUNTRY_VALUES } from "@/lib/alumni-agency-region";

/**
 * Country filter for the jobs board (client-safe — only a type-only Prisma
 * import, erased at build like `lib/forum-identity.ts`).
 *
 * `country` on job posts is FREE TEXT (optional create-form input), and Thai
 * posters routinely leave it blank — so the Thailand branch matches the known
 * Thai spellings OR a null/blank country.
 */
export const JOBS_COUNTRY_ALL = ""; // select value for "ทุกประเทศ" — no filter
export const JOBS_DEFAULT_COUNTRY = "ประเทศไทย";

/** True when the country-filter value selects Thailand (default view). */
export function isThailandFilter(country: string): boolean {
  return isThailandCountry(country);
}

/** Where-fragment for the `?country=` param; null = no filter. */
export function jobCountryWhere(country: string): Prisma.JobPostingWhereInput | null {
  const c = country.trim();
  if (!c) return null;
  if (isThailandCountry(c)) {
    return {
      OR: [
        { country: { in: [...THAILAND_COUNTRY_VALUES], mode: "insensitive" } },
        { country: null },
      ],
    };
  }
  return { country: { equals: c, mode: "insensitive" } };
}

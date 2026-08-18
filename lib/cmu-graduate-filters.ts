/**
 * CLIENT-SAFE CMU graduate filtering — the single source of truth for how a
 * CMU graduate list is narrowed by search + facets.
 *
 * Extracted verbatim from `lib/cmu-registrar.ts` (which is server-only because
 * it imports Prisma) so the all-alumni page's client-side manage pipeline can
 * filter CMU rows with the EXACT same logic the server routes use
 * (`/api/cmu-alumni` list + the alumni Excel export). Never let a second
 * implementation appear — parity is the point.
 *
 * No Prisma, no network — safe in client components and unit tests.
 */

/** Structural input: any object shaped like a CMU graduate record works
 *  (the full `CmuGraduate` interface satisfies this). */
export interface CmuGraduateFilterInput {
  student_id: string;
  name_th: string;
  surname_th: string;
  name_en: string;
  surname_en: string;
  level_id: string;
  major_name_th: string;
  grad_year: string;
}

/**
 * Map a CMU Registrar record's `level_id` (+ `major_name_th`) to our local
 * `DegreeLevel` enum value. Mirrors the predicate in the `/api/cmu-alumni`
 * route so filtering, the table view, and facet counts all agree.
 *
 *   level_id 5            → DOCTORAL
 *   level_id 3            → MASTER
 *   level_id 1            → BACHELOR
 *   level_id 2            → NURSING_ASSISTANT
 *   level_id 0 + nursing  → NURSING_ASSISTANT
 *   level_id 0 (other)    → ASSOCIATE
 *
 * Returns null if the level_id is unrecognized (so it is skipped in counts).
 */
export function cmuLevelToEnum(
  level_id: string,
  major_name_th: string,
): "DOCTORAL" | "MASTER" | "BACHELOR" | "NURSING_ASSISTANT" | "ASSOCIATE" | null {
  switch (level_id) {
    case "5":
      return "DOCTORAL";
    case "3":
      return "MASTER";
    case "1":
      return "BACHELOR";
    case "2":
      return "NURSING_ASSISTANT";
    case "0":
      return major_name_th === "ประกาศนียบัตรผู้ช่วยพยาบาล"
        ? "NURSING_ASSISTANT"
        : "ASSOCIATE";
    default:
      return null;
  }
}

/** Facet/search filters applied to a CMU graduate list. `search` is a substring
 *  (trimmed + lower-cased internally). The three facet arrays are AND-ed; each
 *  matches the same way the `/api/cmu-alumni` list route filters. */
export interface CmuGraduateFilters {
  search?: string;
  degreeLevels?: string[]; // DegreeLevel enum values, via `cmuLevelToEnum`
  majors?: string[]; // trimmed `major_name_th`
  graduationYears?: string[]; // trimmed `grad_year`
}

/**
 * Apply the search + facet filters to a CMU graduate list — the exact logic the
 * `/api/cmu-alumni` list route uses, factored out so the alumni Excel export AND
 * the all-alumni client-side pipeline filter the merged set the same way (no
 * drift). Pure; returns a new array.
 */
export function applyCmuGraduateFilters<T extends CmuGraduateFilterInput>(
  graduates: readonly T[],
  { search, degreeLevels = [], majors = [], graduationYears = [] }: CmuGraduateFilters,
): T[] {
  const q = (search ?? "").trim().toLowerCase();
  let filtered: T[] = q
    ? graduates.filter((g) => {
        const haystack = [g.name_th, g.surname_th, g.student_id, g.name_en, g.surname_en]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
    : [...graduates];

  if (degreeLevels.length || majors.length || graduationYears.length) {
    filtered = filtered.filter((g) => {
      if (degreeLevels.length && !degreeLevels.includes(cmuLevelToEnum(g.level_id, g.major_name_th) ?? "")) {
        return false;
      }
      if (majors.length && !majors.includes((g.major_name_th ?? "").trim())) {
        return false;
      }
      if (graduationYears.length && !graduationYears.includes((g.grad_year ?? "").trim())) {
        return false;
      }
      return true;
    });
  }
  return filtered;
}

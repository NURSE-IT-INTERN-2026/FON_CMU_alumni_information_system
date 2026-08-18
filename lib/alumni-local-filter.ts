/**
 * CLIENT-SAFE filtering of LOCAL `Alumni` rows — the single source of truth
 * for how the local half of the all-alumni table is narrowed by search +
 * facets.
 *
 * Pins the EXACT semantics of `GET /api/alumni`'s where-clause (search OR-block
 * + `parseFacetFilters` facets) and of the alumni Excel export's duplicated
 * where-builder, so the all-alumni page's client-side pipeline, the API route,
 * and the export all filter identically. Never let a second implementation
 * appear — parity is the point.
 *
 * No Prisma, no network — safe in client components and unit tests.
 */

/** Structural input: any object shaped like a local `Alumni` row (as returned
 *  by `/api/alumni` with its education select) satisfies this. */
export interface LocalAlumniFilterInput {
  firstName: string | null;
  lastName: string | null;
  studentId: string;
  degreeLevel: string | null;
  major: string | null;
  graduationYear: number | null;
  /** Education rows — only `studentId` participates in search (a lower-degree
   *  student_id must stay findable in the all-alumni "show all" view). */
  educations?: readonly { studentId: string }[];
}

export interface LocalAlumniFilters {
  /** Raw search term — NOT trimmed and NOT case-folded before matching
   *  (mirrors the route, which passes the query string straight into Prisma
   *  `contains insensitive`; unlike the CMU side, no trim happens here). */
  search?: string;
  degreeLevels?: string[]; // exact `Alumni.degreeLevel` enum values
  majors?: string[]; // exact `Alumni.major` values
  graduationYears?: string[]; // compared numerically (Number-coerced), like YEAR_FIELDS
}

/**
 * Filter local alumni rows the same way `GET /api/alumni` does:
 * - search: case-insensitive substring over firstName / lastName / studentId /
 *   any education's studentId (OR). Empty/whitespace-only... NOTE: the route
 *   checks `if (search)` — only an EMPTY STRING skips the filter; the term is
 *   used raw otherwise. We mirror that (an all-spaces term filters and matches
 *   nothing, same as the server).
 * - facets: exact `in` match, OR within a facet, AND across facets. Values are
 *   trimmed + empties dropped (mirrors `parseFacetFilters`). `graduationYear`
 *   compares numerically (`Number(v)`; a NaN value matches nothing). Null
 *   columns never match a facet.
 * - soft-deleted rows are KEPT — the merge consumes them to build its
 *   deleted-studentId hide-set (matching `?includeDeleted=true`).
 * Pure; returns a new array.
 */
export function filterLocalAlumniRows<T extends LocalAlumniFilterInput>(
  rows: readonly T[],
  { search, degreeLevels, majors, graduationYears }: LocalAlumniFilters,
): T[] {
  const q = search ?? "";
  const needle = q.toLowerCase();
  const levels = normalizeFacet(degreeLevels);
  const majorVals = normalizeFacet(majors);
  const yearVals = (graduationYears ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);

  return rows.filter((r) => {
    if (q) {
      const inFirstName = r.firstName != null && r.firstName.toLowerCase().includes(needle);
      const inLastName = r.lastName != null && r.lastName.toLowerCase().includes(needle);
      const inStudentId = r.studentId.toLowerCase().includes(needle);
      const inEducation =
        r.educations?.some((e) => e.studentId.toLowerCase().includes(needle)) ?? false;
      if (!inFirstName && !inLastName && !inStudentId && !inEducation) return false;
    }
    if (levels.length && !levels.includes(r.degreeLevel ?? "")) return false;
    if (majorVals.length && !majorVals.includes(r.major ?? "")) return false;
    if (yearVals.length && (r.graduationYear == null || !yearVals.includes(r.graduationYear))) {
      return false;
    }
    return true;
  });
}

/** Trim + drop empties, the same normalization `parseFacetFilters` applies to
 *  a comma-separated facet param. */
function normalizeFacet(vals: string[] | undefined): string[] {
  return (vals ?? []).map((s) => s.trim()).filter(Boolean);
}

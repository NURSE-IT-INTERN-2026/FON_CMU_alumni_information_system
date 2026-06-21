/**
 * Pure, client-safe facet helpers — NO Prisma import.
 *
 * This module is imported by client components (the management pages) to build
 * filter query strings, so it must not transitively pull in the Prisma/pg
 * adapter (which requires Node's `dns` and breaks the client bundle).
 *
 * The Prisma-backed `getFacetValues` lives in `lib/filter-facets-server.ts`
 * and is server-only.
 */

/**
 * Entity slug (matches the API path, e.g. "potentials") -> Prisma delegate key.
 * Used by the generic facet endpoint and by parseFacetFilters consumers.
 */
export const ENTITY_DELEGATE: Record<string, string> = {
  alumni: "alumni",
  awards: "award",
  associations: "association",
  "graduate-committee": "graduateCommittee",
  "model-representatives": "modelRepresentative",
  potentials: "potential",
  "alumni-agency": "alumniAgency",
};

/** Fields whose values are integers (years) — facets list them in descending order instead of by count. */
export const YEAR_FIELDS = new Set([
  "recordedYear",
  "graduationYear",
  "termYear",
  "year",
  "generation",
]);

/** Allowed facet fields per entity (PRD §3.3–3.9 filter requirements). */
export const FACET_FIELDS: Record<string, string[]> = {
  alumni: ["degreeLevel", "major", "graduationYear", "currentWorkplace"],
  awards: ["major", "awardType"],
  associations: ["major", "associationName", "position", "recordedYear"],
  "graduate-committee": ["major", "termYear", "cohort", "position"],
  "model-representatives": ["major", "lastName", "cohort", "generation"],
  potentials: ["major", "career", "position", "recordedYear"],
  "alumni-agency": ["major", "country", "workplace"],
};

export interface FacetValue {
  value: string;
  count: number;
}
export interface FacetResult {
  values: FacetValue[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isYear: boolean;
}

/**
 * Parse selected facet values (comma-separated) from query params into Prisma `in` filters.
 * Year fields are coerced to numbers.
 */
export function parseFacetFilters(
  searchParams: URLSearchParams,
  fields: string[]
): Record<string, { in: string[] } | { in: number[] }> {
  const filter: Record<string, { in: string[] } | { in: number[] }> = {};
  for (const f of fields) {
    const raw = searchParams.get(f);
    if (!raw) continue;
    const vals = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (vals.length === 0) continue;
    filter[f] = YEAR_FIELDS.has(f) ? { in: vals.map((v) => Number(v)) } : { in: vals };
  }
  return filter;
}

/** Active facet query string (for appending to list/export URLs). */
export function facetQueryParams(selected: Record<string, string[]>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [field, vals] of Object.entries(selected)) {
    if (vals.length) params.set(field, vals.join(","));
  }
  return params;
}

/**
 * Client-side sorting for the merged all-alumni table.
 *
 * The all-alumni manage table merges CMU Registrar rows with local DB rows
 * (see the `manageQuery` in `app/(admin)/management/all-alumni/page.tsx`).
 * The CMU proxy (`/api/cmu-alumni`) can only sort by CMU fields
 * (name/surname/level/major/year) — local-only fields like `birthDate`,
 * `prefix`, `firstName` have no CMU counterpart and silently fall back to
 * student_id, so those column headers would be cosmetic without this sort.
 *
 * This module is client-safe (no Prisma / Node imports) so it can be imported
 * from the client page component and unit-tested directly.
 */

/** Optional shape: a row that carries `graduationYear` gets numeric sorting
 *  for that field. Other fields always fall back to th-locale string compare,
 *  so a row type does NOT have to satisfy this — it's a documentation hook. */
export interface SortableAlumni {
  graduationYear?: number | null;
}

/**
 * Compare two rows by a sort field, mirroring the CMU proxy's th-locale
 * ordering. Nulls / empty values sort first in ascending order (consistent with
 * how the CMU proxy treats missing strings). `graduationYear` is compared
 * numerically; every other field uses th-locale string comparison.
 *
 * Generic over the concrete row type (manage mode's `Alumni`, view mode's
 * `CmuAlumni`, …) so callers keep their full type — no widening, and no need to
 * satisfy `SortableAlumni`. Dynamic field access is handled by an internal cast.
 */
export function compareAlumni<T>(a: T, b: T, field: string): number {
  if (field === "graduationYear") {
    const ga = (a as unknown as Record<string, unknown>)["graduationYear"];
    const gb = (b as unknown as Record<string, unknown>)["graduationYear"];
    return (typeof ga === "number" ? ga : -Infinity) - (typeof gb === "number" ? gb : -Infinity);
  }
  // The all-alumni "อีเมลติดต่อ" column shows `contactEmail` with a fallback to
  // the login `email` (an alumni may have only one or the other). Sort by that
  // same effective value so a row shown via fallback sorts with its displayed
  // value — sorting on raw `contactEmail` alone would strand those rows as empty.
  if (field === "contactEmail") {
    const eff = (x: T): string => {
      const r = x as unknown as Record<string, unknown>;
      return String(r.contactEmail || r.email || "");
    };
    return eff(a).localeCompare(eff(b), "th");
  }
  const val = (x: T): string => {
    const v = (x as unknown as Record<string, unknown>)[field];
    return v == null ? "" : String(v);
  };
  return val(a).localeCompare(val(b), "th");
}

/**
 * Return a new array sorted by the given field/direction (does not mutate).
 * Use this on the merged CMU+local result so local-only fields reorder rows.
 */
export function sortAlumni<T>(arr: T[], field: string, dir: "asc" | "desc"): T[] {
  return [...arr].sort((a, b) => {
    const cmp = compareAlumni(a, b, field);
    return dir === "desc" ? -cmp : cmp;
  });
}

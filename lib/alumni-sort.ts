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

/** Minimal constraint: a row only needs `graduationYear` for numeric sorting. */
export interface SortableAlumni {
  graduationYear?: number | null;
}

/**
 * Compare two alumni rows by a manage-sort field, mirroring the CMU proxy's
 * th-locale ordering. Nulls / empty values sort first in ascending order
 * (consistent with how the CMU proxy treats missing strings).
 *
 * Generic over the concrete row type so callers keep their full type (no
 * widening); dynamic field access is handled by an internal cast.
 */
export function compareAlumni<T extends SortableAlumni>(
  a: T,
  b: T,
  field: string,
): number {
  if (field === "graduationYear") {
    return (a.graduationYear ?? -Infinity) - (b.graduationYear ?? -Infinity);
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
export function sortAlumni<T extends SortableAlumni>(
  arr: T[],
  field: string,
  dir: "asc" | "desc",
): T[] {
  return [...arr].sort((a, b) => {
    const cmp = compareAlumni(a, b, field);
    return dir === "desc" ? -cmp : cmp;
  });
}

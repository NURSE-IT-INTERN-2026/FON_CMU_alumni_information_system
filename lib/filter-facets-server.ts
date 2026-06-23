/**
 * Server-only facet query logic. Imports Prisma — must NEVER be imported from a
 * client component (that would pull the pg adapter / Node `dns` into the client
 * bundle). Import this only from API route handlers.
 */
import prisma from "@/lib/prisma";
import {
  fetchCmuGraduates,
  cmuLevelToEnum,
  type CmuGraduate,
} from "@/lib/cmu-registrar";
import { dedupeCmuGraduatesByPerson } from "@/lib/alumni-verify";
import {
  ENTITY_DELEGATE,
  FACET_FIELDS,
  YEAR_FIELDS,
  type FacetResult,
  type FacetValue,
} from "@/lib/filter-facets";

/**
 * Return ALL facet values for an entity field in one page (no top-N limit).
 * - String fields: grouped by count, ordered by count desc (tiebreak: value asc).
 * - Year fields: distinct values ordered descending.
 * The `search` contains-filter narrows the set when provided.
 */
export async function getFacetValues(
  entity: string,
  field: string,
  opts: { page?: number; search?: string } = {}
): Promise<FacetResult> {
  const delegateKey = ENTITY_DELEGATE[entity];
  const allowed = FACET_FIELDS[entity];
  if (!delegateKey || !allowed || !allowed.includes(field)) {
    throw new Error("Invalid entity or field");
  }
  const isYear = YEAR_FIELDS.has(field);
  const search = opts.search?.trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[delegateKey];
  const baseWhere: Record<string, unknown> = { deletedAt: null };
  if (search && !isYear) baseWhere[field] = { contains: search, mode: "insensitive" };

  // truthy/non-empty check applied client-side (Prisma 7 rejects `{ not: null }` here)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isRealValue = (v: any) => v !== null && v !== undefined && String(v).trim() !== "";

  if (isYear) {
    const rows = await model.findMany({
      where: baseWhere,
      distinct: [field],
      orderBy: { [field]: "desc" },
      select: { [field]: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vals = rows.map((r: any) => r[field]).filter(isRealValue);
    if (search) vals = vals.filter((v: any) => String(v).includes(search));
    return {
      values: vals.map((v: number) => ({ value: String(v), count: 0 })),
      total: vals.length,
      page: 1,
      pageSize: vals.length,
      totalPages: 1,
      isYear: true,
    };
  }

  // Single groupBy over the whole set (count desc, value asc tiebreak) — no pagination.
  const groups = await model.groupBy({
    by: [field],
    where: baseWhere,
    _count: { _all: true },
    orderBy: [{ _count: { [field]: "desc" } }, { [field]: "asc" }],
  });
  const values: FacetValue[] = groups
    .filter((g: any) => isRealValue(g[field]))
    .map((g: any) => ({ value: String(g[field]), count: g._count?._all ?? 0 }));
  return {
    values,
    total: values.length,
    page: 1,
    pageSize: values.length,
    totalPages: 1,
    isYear: false,
  };
}

/**
 * Alumni facet fields that have a CMU Registrar counterpart and therefore need
 * their counts merged across both sources. `currentWorkplace` has no CMU
 * equivalent and stays on the local-only {@link getFacetValues} path.
 */
const ALUMNI_CMU_BACKED_FIELDS = new Set(["degreeLevel", "major", "graduationYear"]);

/** Whether an alumni facet field should pull CMU Registrar data into its counts. */
export function isAlumniCmuBackedField(field: string): boolean {
  return ALUMNI_CMU_BACKED_FIELDS.has(field);
}

/** Effective facet value for a CMU-only record (no local overlay). */
function cmuFieldValue(g: CmuGraduate, field: string): string | null {
  switch (field) {
    case "degreeLevel":
      return cmuLevelToEnum(g.level_id, g.major_name_th);
    case "major":
      return g.major_name_th || null;
    case "graduationYear":
      return g.grad_year || null;
    default:
      return null;
  }
}

/**
 * Alumni-specific facet values that merge the CMU Registrar dataset with the
 * local DB — mirroring exactly what the all-alumni table displays.
 *
 * Counting rules (same overlay/dedup semantics as the page's merge logic):
 *  - For each CMU graduate (excluding those soft-deleted locally): if a local
 *    record exists for that studentId, the LOCAL field value wins (it fully
 *    overlays the CMU record, even when null); otherwise the CMU-derived value
 *    is used.
 *  - Local records whose studentId does NOT appear in CMU are counted on their
 *    own (local-only rows appended by the page).
 *  - Soft-deleted local records are excluded entirely (and also hide their CMU
 *    counterpart).
 */
export async function getAlumniFacetValues(
  field: string,
  opts: { page?: number; search?: string } = {}
): Promise<FacetResult> {
  if (!isAlumniCmuBackedField(field)) {
    throw new Error(`Alumni field "${field}" is not CMU-backed`);
  }
  const isYear = YEAR_FIELDS.has(field);
  const search = opts.search?.trim().toLowerCase();

  const [cmuGraduatesRaw, localAlumni] = await Promise.all([
    fetchCmuGraduates(),
    prisma.alumni.findMany({
      select: {
        studentId: true,
        degreeLevel: true,
        major: true,
        graduationYear: true,
        deletedAt: true,
      },
    }),
  ]);
  // Collapse a person's multiple CMU degree records into their highest degree
  // so facet counts match the all-alumni table (which dedups the same way).
  const cmuGraduates = dedupeCmuGraduatesByPerson(cmuGraduatesRaw);

  const cmuStudentIds = new Set(cmuGraduates.map((g) => g.student_id));
  const deletedStudentIds = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const localByStudentId = new Map<string, any>();
  for (const a of localAlumni) {
    if (!a.studentId) continue;
    if (a.deletedAt) deletedStudentIds.add(a.studentId);
    localByStudentId.set(a.studentId, a);
  }

  const counts = new Map<string, number>();
  const tally = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return;
    const s = String(v).trim();
    if (!s) return;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  };

  // CMU records — local overlay wins where a local record exists.
  for (const g of cmuGraduates) {
    if (deletedStudentIds.has(g.student_id)) continue;
    const local = localByStudentId.get(g.student_id);
    if (local) {
      tally(local[field]);
    } else {
      tally(cmuFieldValue(g, field));
    }
  }

  // Local-only records (studentId not present in CMU), excluding soft-deleted.
  for (const a of localByStudentId.values()) {
    if (deletedStudentIds.has(a.studentId)) continue;
    if (cmuStudentIds.has(a.studentId)) continue;
    tally(a[field]);
  }

  if (isYear) {
    let vals = [...counts.keys()].sort((a, b) => Number(b) - Number(a));
    if (search) vals = vals.filter((v) => v.includes(search));
    return {
      values: vals.map((v) => ({ value: v, count: 0 })),
      total: vals.length,
      page: 1,
      pageSize: vals.length,
      totalPages: 1,
      isYear: true,
    };
  }

  let entries = [...counts.entries()];
  if (search) entries = entries.filter(([v]) => v.toLowerCase().includes(search));
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"));
  return {
    values: entries.map(([value, count]) => ({ value, count })),
    total: entries.length,
    page: 1,
    pageSize: entries.length,
    totalPages: 1,
    isYear: false,
  };
}

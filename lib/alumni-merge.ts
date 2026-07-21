/**
 * Shared CMU + local alumni merge — the single source of truth for how the
 * all-alumni table builds its rows. Consumed by BOTH the on-screen table
 * (`app/(admin)/management/all-alumni/page.tsx`, client) and the Excel export
 * (`app/api/alumni/export/route.ts`, server), so the export can never drift
 * from what the table shows.
 *
 * CLIENT-SAFE: imports only pure helpers from `@/lib/alumni-verify` — no Prisma,
 * no Node-only modules — so it crosses the `"use client"` boundary freely.
 *
 * This is a verbatim extraction of the merge that previously lived inline in
 * the page's `manageQuery`. Behavior is identical; the only additions are
 * generalized structural input types and defensive `student_id` trimming (a
 * no-op for the clean ids both call sites already supply, but correct for any
 * future raw input).
 */
import {
  normalizeCmuBirthday,
  bachelorCohortFromGradYear,
  cmuLevelToDegree,
} from "@/lib/alumni-verify";

/** A local education row — the subset of `Education` the merge reads. */
export interface EducationInput {
  studentId: string;
  degreeLevel?: string | null;
  graduationYear?: number | null;
  major?: string | null;
  cohort?: string | null;
}

/**
 * A local alumni row — mirrors the page's `Alumni` interface, plus an optional
 * `deletedAt` (Prisma returns a `Date`; the page's JSON-serialized rows return
 * a `string`; both truthy-check the same so the merge can skip soft-deleted
 * rows). Required string fields match the page's shape, so a spread of this
 * satisfies {@link MergedAlumni}.
 */
export interface LocalAlumniInput {
  id: string;
  studentId: string;
  prefix: string;
  firstName: string;
  lastName: string;
  cohort: string | null;
  degreeLevel: string | null;
  major: string | null;
  graduationYear: number | null;
  birthDate: string | null;
  remarks: string | null;
  email: string | null;
  contactEmail: string | null;
  phones: string[];
  homeAddress: string | null;
  isPotential: boolean;
  isModelRepresentative: boolean;
  photoUrl: string | null;
  deletedAt?: string | Date | null;
  educations?: EducationInput[];
}

/**
 * A CMU graduate row — the structural subset the merge reads. Both the page's
 * `CmuAlumni` (the `/api/cmu-alumni` response shape) and the server's
 * `CmuGraduate` (from `getCmuGraduatesLocal`) are assignable to this.
 */
export interface CmuAlumniInput {
  student_id: string;
  /** All of this CMU person's degree studentIds (attached by dedupe). */
  student_ids?: string[];
  level_id?: string | null;
  grad_year?: string | number | null;
  major_name_th?: string | null;
  birthday?: string | null;
  name_th?: string | null;
  surname_th?: string | null;
}

/** A merged table row — the shape both the table cells and the export read. */
export interface MergedAlumni {
  id: string;
  studentId: string;
  prefix: string;
  firstName: string;
  lastName: string;
  cohort: string | null;
  degreeLevel: string | null;
  major: string | null;
  graduationYear: number | null;
  birthDate: string | null;
  remarks: string | null;
  email: string | null;
  contactEmail: string | null;
  phones: string[];
  homeAddress: string | null;
  isPotential: boolean;
  isModelRepresentative: boolean;
  photoUrl: string | null;
}

export interface MergeOptions {
  /** `true` (default table view) collapses each person to their highest degree;
   *  `false` ("แสดงทุกวุฒิ") lists every degree record as its own row. */
  dedupeView: boolean;
  /** Active search term (lower-cased internally). Only affects the show-all
   *  local-education branch, mirroring the server-side search. */
  search: string;
}

/** Build a studentId → local alumni map covering EVERY education studentId of
 *  each alumni (plus its primary snapshot), so a CMU record bridges to a local
 *  alumni on any of the alumni's degrees — collapsing multi-degree alumni to
 *  one row (matching the dashboard's person grouping). */
function buildEduSidToLocalMap(local: readonly LocalAlumniInput[]): Map<string, LocalAlumniInput> {
  const m = new Map<string, LocalAlumniInput>();
  for (const a of local) {
    const sids = new Set<string>();
    if (a.studentId) sids.add(a.studentId.trim());
    for (const e of a.educations ?? []) if (e.studentId) sids.add(e.studentId.trim());
    for (const s of sids) if (s) m.set(s, a);
  }
  return m;
}

/** Find the local alumni bridged to a CMU record — the alumni whose ANY
 *  education studentId appears in the CMU person's student_ids. Returns the
 *  alumni (to overlay + mark used) or undefined (CMU-only row). */
function findLocalByCmuRecord(
  c: CmuAlumniInput,
  eduSidToLocal: Map<string, LocalAlumniInput>,
): LocalAlumniInput | undefined {
  const sids = c.student_ids?.length ? c.student_ids : c.student_id ? [c.student_id] : [];
  for (const s of sids) {
    const a = eduSidToLocal.get(String(s).trim());
    if (a) return a;
  }
  return undefined;
}

/** Set of every student_id across the given CMU records (every person's whole
 *  degree set), trimmed. A local alumni is "represented by a CMU row" (so it is
 *  NOT shown as a local-only row) when ANY of its education studentIds is in
 *  this set. */
function buildCmuSidSet(cmu: readonly CmuAlumniInput[]): Set<string> {
  const set = new Set<string>();
  for (const c of cmu) {
    const sids = c.student_ids?.length ? c.student_ids : c.student_id ? [c.student_id] : [];
    for (const sid of sids) {
      const t = String(sid).trim();
      if (t) set.add(t);
    }
  }
  return set;
}

/** Ids of local alumni that have ANY education studentId in the CMU sid set —
 *  i.e. represented by a CMU row, so excluded from the local-only pass. */
function buildUsedAlumniIds(
  local: readonly LocalAlumniInput[],
  cmuSidSet: Set<string>,
  deletedStudentIds: Set<string>,
): Set<string> {
  const used = new Set<string>();
  for (const a of local) {
    if (deletedStudentIds.has(a.studentId.trim())) continue;
    const sids = [a.studentId.trim(), ...(a.educations ?? []).map((e) => e.studentId.trim())];
    if (sids.some((s) => s && cmuSidSet.has(s))) used.add(a.id);
  }
  return used;
}

/**
 * Merge CMU + local alumni into the table's row set. UNORDERED — callers sort
 * via `sortAlumni(merged, field, dir)` (the table sorts client-side; the export
 * sorts server-side) so this stays a pure data operation.
 *
 * Mirrors the dashboard's person grouping: a person with multiple FON degrees
 * collapses to one row (their highest, via `dedupeCmuGraduatesByPerson` on the
 * CMU side + the `student_ids` bridge on the local side); local-only alumni
 * (no CMU record) are appended; soft-deleted alumni and their CMU rows are
 * skipped.
 */
export function mergeAlumniTableRows(
  cmuRows: readonly CmuAlumniInput[],
  localInput: readonly LocalAlumniInput[],
  { dedupeView, search }: MergeOptions,
): MergedAlumni[] {
  // Mirror the page's `localMap`: only rows with a non-empty studentId (the
  // DB `studentId` is unique + non-null, so this is a no-op for real data).
  const local = localInput.filter(
    (a) => typeof a.studentId === "string" && a.studentId.trim() !== "",
  );

  // Soft-deleted local alumni (and the CMU rows for their studentId) are
  // hidden — this is how the table "deletes" a CMU-backed row.
  const deletedStudentIds = new Set<string>();
  for (const a of local) {
    if (a.deletedAt) deletedStudentIds.add(a.studentId.trim());
  }

  const merged: MergedAlumni[] = [];
  const eduSidToLocal = buildEduSidToLocalMap(local);
  const cmuSidSet = buildCmuSidSet(cmuRows);
  const usedAlumni = buildUsedAlumniIds(local, cmuSidSet, deletedStudentIds);

  for (const c of cmuRows) {
    const sid = String(c.student_id ?? "").trim();
    if (deletedStudentIds.has(sid)) continue;
    const localRow = findLocalByCmuRecord(c, eduSidToLocal);
    const derivedCohort =
      c.level_id === "1" && c.grad_year ? bachelorCohortFromGradYear(c.grad_year) : null;
    if (!dedupeView) {
      const cmuDegreeLevel = cmuLevelToDegree(c.level_id, c.major_name_th);
      if (localRow) {
        merged.push({
          ...localRow,
          studentId: sid,
          degreeLevel: cmuDegreeLevel,
          major: c.major_name_th || localRow.major,
          graduationYear: c.grad_year ? Number(c.grad_year) : localRow.graduationYear,
          cohort: localRow.cohort || derivedCohort,
          birthDate: normalizeCmuBirthday(c.birthday) ?? localRow.birthDate,
        });
      } else {
        merged.push({
          id: sid,
          studentId: sid,
          prefix: "",
          firstName: c.name_th || "",
          lastName: c.surname_th || "",
          cohort: derivedCohort,
          degreeLevel: cmuDegreeLevel,
          major: c.major_name_th || null,
          graduationYear: c.grad_year ? Number(c.grad_year) : null,
          birthDate: normalizeCmuBirthday(c.birthday),
          remarks: null,
          email: null,
          contactEmail: null,
          phones: [],
          homeAddress: null,
          isPotential: false,
          isModelRepresentative: false,
          photoUrl: null,
        });
      }
    } else if (localRow) {
      merged.push({
        ...localRow,
        cohort: localRow.cohort || derivedCohort,
        birthDate: normalizeCmuBirthday(c.birthday) ?? localRow.birthDate,
      });
    } else {
      merged.push({
        id: sid,
        studentId: sid,
        prefix: "",
        firstName: c.name_th || "",
        lastName: c.surname_th || "",
        cohort: derivedCohort,
        degreeLevel: null,
        major: c.major_name_th || null,
        graduationYear: c.grad_year ? Number(c.grad_year) : null,
        birthDate: normalizeCmuBirthday(c.birthday),
        remarks: null,
        email: null,
        contactEmail: null,
        phones: [],
        homeAddress: null,
        isPotential: false,
        isModelRepresentative: false,
        photoUrl: null,
      });
    }
  }

  const q = search.trim().toLowerCase();
  for (const a of local) {
    if (deletedStudentIds.has(a.studentId.trim())) continue;
    const derivedLocal =
      a.degreeLevel === "BACHELOR" && a.graduationYear
        ? bachelorCohortFromGradYear(a.graduationYear)
        : null;

    if (dedupeView) {
      if (usedAlumni.has(a.id)) continue;
      merged.push({ ...a, cohort: a.cohort || derivedLocal });
      continue;
    }

    const eduList = (a.educations ?? []).filter((e) => e.studentId);
    if (eduList.length === 0) {
      merged.push({ ...a, cohort: a.cohort || derivedLocal });
      continue;
    }
    const firstNameLc = (a.firstName || "").toLowerCase();
    const lastNameLc = (a.lastName || "").toLowerCase();
    for (const e of eduList) {
      if (cmuSidSet.has(e.studentId.trim())) continue; // CMU loop rendered this degree
      if (q) {
        const matches =
          e.studentId.toLowerCase().includes(q) || firstNameLc.includes(q) || lastNameLc.includes(q);
        if (!matches) continue;
      }
      const derivedEduCohort =
        e.degreeLevel === "BACHELOR" && e.graduationYear
          ? bachelorCohortFromGradYear(e.graduationYear)
          : null;
      merged.push({
        ...a,
        studentId: e.studentId,
        degreeLevel: e.degreeLevel ?? null,
        major: e.major ?? a.major,
        graduationYear: e.graduationYear ?? a.graduationYear,
        cohort: e.cohort || derivedEduCohort || a.cohort,
      });
    }
  }

  return merged;
}

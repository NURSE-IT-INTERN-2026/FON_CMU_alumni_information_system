/**
 * Classify materialized CMU graduates as "linked" (a matching local alumni
 * exists) vs "unlinked" (known to the Registrar but not yet an alumni record).
 *
 * Server-only — reads Prisma. Shared by:
 *   - GET /api/cmu-alumni?linkState=linked|unlinked  (the cmu-sync tables)
 *   - GET /api/cmu-alumni/link-counts                 (the cmu-sync tab badges)
 *
 * "Linked" follows the same rule the all-alumni table + dashboard use: a CMU
 * person counts as in-our-DB when ANY of their studentIds (the deduped
 * `student_ids` set, or the raw `student_id`) is in the union of
 * `Alumni.studentId` + every `education.studentId`. Matching `Alumni.studentId`
 * alone would misclassify multi-degree people — the primary snapshot holds only
 * one of their degree studentIds (see the "Education / primary snapshot" pitfall
 * in CLAUDE.md). This intentionally does NOT copy `getAlumniFacetValues`'s
 * primary-only match, which is a known inconsistency.
 */
import prisma from "@/lib/prisma";
import type { CmuGraduate } from "@/lib/cmu-registrar";

/**
 * The set of studentIds that denote "this person is already in our alumni DB":
 * every non-deleted alumni's primary `studentId` PLUS every `education.studentId`
 * (a person with several FON degrees has one education row — and one studentId —
 * per degree; the primary snapshot only holds one of them).
 */
export async function getLocalAlumniStudentIdSet(): Promise<Set<string>> {
  const rows = await prisma.alumni.findMany({
    where: { deletedAt: null },
    select: { studentId: true, educations: { select: { studentId: true } } },
  });
  const set = new Set<string>();
  for (const a of rows) {
    const sid = a.studentId?.trim();
    if (sid) set.add(sid);
    for (const e of a.educations) {
      const esid = e.studentId?.trim();
      if (esid) set.add(esid);
    }
  }
  return set;
}

/**
 * A CMU record is linked iff ANY of its studentIds is local. Deduped records
 * carry the person's full `student_ids` set; raw (un-deduped) records only have
 * `student_id`. Both are handled.
 */
export function isCmuLinked(g: CmuGraduate, localSidSet: Set<string>): boolean {
  const sids = g.student_ids?.length
    ? g.student_ids
    : g.student_id
      ? [g.student_id]
      : [];
  return sids.some((s) => localSidSet.has(String(s).trim()));
}

/** Split a list of CMU records into linked / unlinked against the local set. */
export function classifyCmuByLink(
  records: CmuGraduate[],
  localSidSet: Set<string>,
): { linked: CmuGraduate[]; unlinked: CmuGraduate[] } {
  const linked: CmuGraduate[] = [];
  const unlinked: CmuGraduate[] = [];
  for (const g of records) {
    if (isCmuLinked(g, localSidSet)) linked.push(g);
    else unlinked.push(g);
  }
  return { linked, unlinked };
}

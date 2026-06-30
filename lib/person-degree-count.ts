/**
 * Server-only merged person-degree counting. Must NOT be imported from a client
 * component (pulls in Prisma + the CMU fetch).
 *
 * The dashboard "alumni by degree level" must count each PERSON once, under
 * their highest degree — across BOTH the CMU Registrar data AND the local
 * `education` rows (so a locally-added higher degree upgrades the person, and
 * nobody is double-counted when they appear in both sources).
 *
 * People are merged via union-find over three signals:
 *   1. CMU records sharing normalized first+last name + birthday.
 *   2. A local alumni's `education` rows (all share one `alumniId`).
 *   3. A cross-source bridge: any entities sharing a `studentId`
 *      (a local education whose studentId matches a CMU record joins that CMU
 *      person — the same studentId denotes the same degree enrollment).
 *
 * The dashboard count includes EVERY person — CMU registrar persons AND
 * local-only persons (alumni in the local DB whose studentId isn't in CMU, e.g.
 * admin-created or legacy-Excel-imported). The all-alumni table shows local-only
 * alumni too, so the dashboard counts them to stay consistent with the table
 * total. `groupPersonsByDegree` still flags each person with `hasCmu` (kept for
 * observability); `getPersonDegreeBreakdown` no longer filters on it.
 */
import prisma from "@/lib/prisma";
import { fetchCmuGraduates, type CmuGraduate } from "@/lib/cmu-registrar";
import {
  DEGREE_RANK,
  cmuLevelToDegree,
  normalizeName,
  normalizeCmuBirthday,
  type DegreeLevelValue,
} from "@/lib/alumni-verify";

interface DegreeEntity {
  degreeRank: number; // 0 = unrecognized degree
  year: number | null; // Buddhist graduation year
}

interface LocalAlumniInput {
  alumniId: string;
  educations: { studentId: string; degreeLevel: string; graduationYear: number | null }[];
}

export interface PersonDegreeBreakdown {
  byDegree: Record<string, number>;
  total: number;
  /** graduationYear (Buddhist, string) → degreeLevel → person count. */
  byYearDegree: Record<string, Record<string, number>>;
}

const RANK_TO_DEGREE = Object.fromEntries(
  Object.entries(DEGREE_RANK).map(([degree, rank]) => [rank, degree]),
) as Record<number, DegreeLevelValue>;

function parseYear(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Pure grouping core (no I/O) — unit-testable. Returns one entry per PERSON:
 * their highest degree (null if none recognized), that degree's representative
 * year (most recent among their highest-degree entities), and `hasCmu` — whether
 * the group includes any CMU record (i.e. the person is in the registrar
 * universe). `hasCmu` is informational only; `getPersonDegreeBreakdown` counts
 * all persons (CMU + local-only) to match the all-alumni table.
 */
export function groupPersonsByDegree(
  cmu: CmuGraduate[],
  local: LocalAlumniInput[],
): { degree: DegreeLevelValue | null; year: number | null; hasCmu: boolean }[] {
  const entities = new Map<string, DegreeEntity[]>();
  const studentIdToEntities = new Map<string, string[]>();

  const addEntity = (id: string, e: DegreeEntity) => {
    const arr = entities.get(id);
    if (arr) arr.push(e);
    else entities.set(id, [e]);
  };
  const linkStudentId = (sid: string, id: string) => {
    const arr = studentIdToEntities.get(sid);
    if (arr) arr.push(id);
    else studentIdToEntities.set(sid, [id]);
  };

  // CMU records → one entity each.
  for (let i = 0; i < cmu.length; i++) {
    const g = cmu[i];
    const id = `c:${i}`;
    const degree = cmuLevelToDegree(g.level_id, g.major_name_th);
    addEntity(id, {
      degreeRank: degree ? (DEGREE_RANK[degree] ?? 0) : 0,
      year: parseYear(g.grad_year),
    });
    const sid = String(g.student_id ?? "").trim();
    if (sid) linkStudentId(sid, id);
  }

  // Local alumni → one entity each, aggregating their education rows.
  for (const a of local) {
    const id = `l:${a.alumniId}`;
    for (const e of a.educations) {
      addEntity(id, {
        degreeRank: DEGREE_RANK[e.degreeLevel as DegreeLevelValue] ?? 0,
        year: e.graduationYear,
      });
      const sid = String(e.studentId ?? "").trim();
      if (sid) linkStudentId(sid, id);
    }
  }

  // Union-find over entity ids.
  const parent = new Map<string, string>();
  for (const id of entities.keys()) parent.set(id, id);
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // (1) CMU records sharing normalized name + birthday.
  const keyToFirstId = new Map<string, string>();
  for (let i = 0; i < cmu.length; i++) {
    const g = cmu[i];
    const id = `c:${i}`;
    const fn = normalizeName(g.name_th);
    const ln = normalizeName(g.surname_th);
    const bd = normalizeCmuBirthday(g.birthday);
    if (!fn || !ln || !bd) continue; // incomplete identity → stays standalone
    const key = `${fn}\u0000${ln}\u0000${bd}`;
    const prev = keyToFirstId.get(key);
    if (prev) union(prev, id);
    else keyToFirstId.set(key, id);
  }

  // (3) Cross-source (and CMU↔CMU) bridge via shared studentId.
  for (const ids of studentIdToEntities.values()) {
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
  }

  // Aggregate entities into groups by root. Track whether each group includes a
  // CMU entity — only CMU-universe persons are counted by the dashboard.
  const groups = new Map<string, DegreeEntity[]>();
  const groupHasCmu = new Map<string, boolean>();
  for (const id of entities.keys()) {
    const root = find(id);
    const arr = groups.get(root);
    const ents = entities.get(id)!;
    if (arr) for (const e of ents) arr.push(e);
    else groups.set(root, [...ents]);
    if (id.startsWith("c:")) groupHasCmu.set(root, true);
  }

  const persons: { degree: DegreeLevelValue | null; year: number | null; hasCmu: boolean }[] = [];
  for (const [root, ents] of groups.entries()) {
    let maxRank = -1;
    for (const e of ents) if (e.degreeRank > maxRank) maxRank = e.degreeRank;
    const degree = maxRank > 0 ? RANK_TO_DEGREE[maxRank] ?? null : null;
    // Representative year: most recent among the person's highest-degree rows.
    let year: number | null = null;
    for (const e of ents) {
      if (e.degreeRank === maxRank && e.year != null && (year == null || e.year > year)) {
        year = e.year;
      }
    }
    persons.push({ degree, year, hasCmu: groupHasCmu.get(root) === true });
  }
  return persons;
}

/** Fetch both sources, group into persons, and aggregate for the dashboard. */
export async function getPersonDegreeBreakdown(): Promise<PersonDegreeBreakdown> {
  const [cmu, localAlumni] = await Promise.all([
    fetchCmuGraduates(),
    prisma.alumni.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        educations: {
          select: { studentId: true, degreeLevel: true, graduationYear: true },
        },
      },
    }),
  ]);

  const persons = groupPersonsByDegree(
    cmu,
    localAlumni.map((a) => ({
      alumniId: a.id,
      educations: a.educations.map((e) => ({
        studentId: e.studentId,
        degreeLevel: e.degreeLevel,
        graduationYear: e.graduationYear,
      })),
    })),
  );

  const byDegree: Record<string, number> = {};
  const byYearDegree: Record<string, Record<string, number>> = {};
  let total = 0;
  for (const p of persons) {
    // Count EVERY person — CMU registrar persons AND local-only persons (no CMU
    // record). The all-alumni table shows local-only alumni too, so the
    // dashboard must count them to stay consistent with the table total. Local
    // education still upgrades a CMU person's degree via the merge above; the
    // `hasCmu` flag is retained for observability but no longer filters.
    total++;
    if (!p.degree) continue; // unrecognized degree → counts toward total only
    byDegree[p.degree] = (byDegree[p.degree] ?? 0) + 1;
    if (p.year != null) {
      const y = String(p.year);
      byYearDegree[y] ??= {};
      byYearDegree[y][p.degree] = (byYearDegree[y][p.degree] ?? 0) + 1;
    }
  }
  return { byDegree, total, byYearDegree };
}

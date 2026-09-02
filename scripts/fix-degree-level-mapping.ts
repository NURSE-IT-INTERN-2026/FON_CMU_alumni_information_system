/**
 * Data remediation for the corrected CMU level_id → degree mapping (2026-09:
 * 0=NURSING_ASSISTANT, 1=BACHELOR, 3=MASTER, 5=DOCTORAL, else=ASSOCIATE).
 *
 * `cmu_graduates` stores the raw levelId (degree is derived on read), so no
 * re-sync is needed — but values MATERIALIZED under the old wrong mapping
 * (Alumni.degreeLevel snapshot + Education.degreeLevel, written by ensureAlumni
 * / signup-approve / education routes) stay stale. This script re-derives them
 * for rows whose studentId maps to an affected CMU record, overwriting ONLY
 * values the old mapping produced (a manually corrected value is left alone).
 *
 * Safe to re-run (idempotent: after the first pass nothing matches the guard).
 *
 *   node --env-file=.env --import tsx scripts/fix-degree-level-mapping.ts
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/fix-degree-level-mapping.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import { cmuLevelToDegree, type DegreeLevelValue } from "@/lib/alumni-verify";
import { recomputePrimaryEducation } from "@/lib/education-sync";

const DRY_RUN = process.env.DRY_RUN === "1";

const NURSING_ASSISTANT_MAJOR = "ประกาศนียบัตรผู้ช่วยพยาบาล";

/**
 * Snapshot of the OLD (pre-2026-09, wrong) mapping — the exact values the
 * materialized rows were written with. Kept verbatim (incl. the major check
 * and the BACHELOR fallback) so the overwrite guard matches what the old code
 * would have produced.
 */
function oldCmuLevelToDegree(
  levelId: string | null | undefined,
  majorNameTh: string | null | undefined,
): DegreeLevelValue {
  switch (String(levelId ?? "")) {
    case "5":
      return "DOCTORAL";
    case "3":
      return "MASTER";
    case "2":
      return "NURSING_ASSISTANT";
    case "1":
      return "BACHELOR";
    case "0":
      return (majorNameTh ?? "").trim() === NURSING_ASSISTANT_MAJOR
        ? "NURSING_ASSISTANT"
        : "ASSOCIATE";
    default:
      return "BACHELOR";
  }
}

interface Fix {
  studentId: string; // trimmed
  oldDegree: DegreeLevelValue;
  newDegree: DegreeLevelValue;
}

async function main() {
  // Candidates: every CMU row whose level is not one of the stable ids — the
  // old/new tables only diverge for "0" (major-dependent), "2", and unknowns.
  const candidates = await prisma.cmuGraduate.findMany({
    where: { levelId: { notIn: ["1", "3", "5"] } },
    select: { studentId: true, levelId: true, majorNameTh: true },
  });

  const fixes = new Map<string, Fix>();
  for (const g of candidates) {
    const sid = String(g.studentId ?? "").trim();
    if (!sid) continue;
    const oldDegree = oldCmuLevelToDegree(g.levelId, g.majorNameTh);
    const newDegree = cmuLevelToDegree(g.levelId);
    if (newDegree !== oldDegree) {
      fixes.set(sid, { studentId: sid, oldDegree, newDegree });
    }
  }

  console.log(`\n=== CMU records whose degree changes under the new mapping: ${fixes.size} ===`);

  // Education rows whose studentId keys into an affected CMU record.
  const sids = [...fixes.keys()];
  const educations = sids.length
    ? await prisma.education.findMany({
        where: { studentId: { in: sids } },
        select: { id: true, alumniId: true, studentId: true, degreeLevel: true },
      })
    : [];
  const eduToFix = educations.filter((e) => fixes.get(e.studentId)?.oldDegree === e.degreeLevel);
  const eduSkipped = educations.length - eduToFix.length;

  // Alumni snapshot rows (the studentId FK target of the 6 related tables).
  const alumniRows = sids.length
    ? await prisma.alumni.findMany({
        where: { studentId: { in: sids } },
        select: { id: true, studentId: true, degreeLevel: true },
      })
    : [];
  const alumniToFix = alumniRows.filter(
    (a) => fixes.get(a.studentId)?.oldDegree === a.degreeLevel,
  );
  const alumniSkipped = alumniRows.length - alumniToFix.length;

  for (const e of eduToFix) {
    const f = fixes.get(e.studentId)!;
    console.log(
      `  education ${e.id} (alumni ${e.alumniId}) studentId=${e.studentId}: ${f.oldDegree} → ${f.newDegree}`,
    );
  }
  for (const a of alumniToFix) {
    const f = fixes.get(a.studentId)!;
    console.log(
      `  alumni ${a.id} studentId=${a.studentId}: ${f.oldDegree} → ${f.newDegree}`,
    );
  }
  console.log(
    `  skipped (value ≠ old mapping — already corrected or manually edited): ${eduSkipped} education, ${alumniSkipped} alumni`,
  );

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1 → no changes made.");
    return;
  }
  if (eduToFix.length === 0 && alumniToFix.length === 0) {
    console.log("\nNothing to fix.");
    return;
  }

  let educationFixed = 0;
  let snapshotFixed = 0;
  let recomputed = 0;

  await prisma.$transaction(async (tx) => {
    // 1. Fix the Education rows (the canonical degree records).
    for (const e of eduToFix) {
      const f = fixes.get(e.studentId)!;
      await tx.education.update({
        where: { id: e.id },
        data: { degreeLevel: f.newDegree },
      });
      educationFixed++;
    }

    // 2. Re-derive each touched alumni's primary + snapshot the canonical way.
    const touchedAlumniIds = new Set([
      ...eduToFix.map((e) => e.alumniId),
      ...alumniToFix.map((a) => a.id),
    ]);
    for (const alumniId of touchedAlumniIds) {
      await recomputePrimaryEducation(alumniId, tx);
      recomputed++;
    }

    // 3. Snapshot-only leftovers: alumni with NO education rows (recompute is
    //    a no-op for them) keep the stale snapshot → update directly. Rows
    //    whose snapshot was just re-synced no longer match the old value.
    for (const a of alumniToFix) {
      const f = fixes.get(a.studentId)!;
      const res = await tx.alumni.updateMany({
        where: { id: a.id, degreeLevel: f.oldDegree },
        data: { degreeLevel: f.newDegree },
      });
      snapshotFixed += res.count;
    }
  });

  console.log(
    `\nFixed ${educationFixed} education row(s), ${snapshotFixed} snapshot-only alumni row(s); recomputed primary for ${recomputed} alumni.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

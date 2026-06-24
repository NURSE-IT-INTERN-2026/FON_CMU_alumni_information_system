/**
 * Data-integrity audit + cleanup: find every education whose studentId belongs
 * to a DIFFERENT person than its alumni (CMU birthday ≠ the alumni's birthday)
 * and remove it — together with the SYSTEM graduation log + field-change rows
 * that were generated for it. Safe to re-run (idempotent: nothing to do when
 * there are no strays).
 *
 * These stray records are the bug behind the all-alumni/dashboard inconsistency:
 * a stranger's degree attached to an alumni stays as a separate table row AND
 * corrupts the dashboard's person-merge count. The add-/edit-education identity
 * guard (`lib/education-identity.ts`) now prevents new ones; this cleans up any
 * that pre-date the guard.
 *
 *   node --env-file=.env --import tsx scripts/remove-stray-education.ts
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/remove-stray-education.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import { normalizeCmuBirthday, normalizeFormBirthDate } from "@/lib/alumni-verify";
import { syncNameFromHighestDegree } from "@/lib/name-sync";

const DRY_RUN = process.env.DRY_RUN === "1";

interface Stray {
  alumniId: string;
  educationId: string;
  studentId: string;
  degreeLevel: string;
  alumniBday: string | null;
  strayBday: string | null;
}

async function main() {
  const alumni = await prisma.alumni.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      studentId: true,
      birthDate: true,
      educations: { select: { id: true, studentId: true, degreeLevel: true } },
    },
  });

  const refBday = normalizeFormBirthDate; // alias
  const strays: Stray[] = [];

  for (const a of alumni) {
    // Reference identity: the alumni's verified birthday (signup), else the CMU
    // birthday of their primary (snapshot) studentId.
    let ref = refBday(a.birthDate);
    if (!ref && a.studentId) {
      const cmu = await fetchCmuGraduateById(a.studentId).catch(() => null);
      ref = cmu ? normalizeCmuBirthday(cmu.birthday) : null;
    }
    if (!ref) continue; // can't establish identity → skip (can't prove stray)

    for (const e of a.educations) {
      if (e.studentId === a.studentId) continue; // the primary — defines the identity
      const cmu = await fetchCmuGraduateById(e.studentId).catch(() => null);
      if (!cmu) continue; // not in CMU → can't prove stray
      const eb = normalizeCmuBirthday(cmu.birthday);
      if (!eb) continue; // no birthday → can't prove stray
      if (eb !== ref) {
        strays.push({
          alumniId: a.id,
          educationId: e.id,
          studentId: e.studentId,
          degreeLevel: e.degreeLevel,
          alumniBday: ref,
          strayBday: eb,
        });
      }
    }
  }

  console.log(`\n=== Stray (different-person) educations found: ${strays.length} ===`);
  for (const s of strays) {
    console.log(
      `  alumni ${s.alumniId} ← edu ${s.educationId} studentId=${s.studentId} (${s.degreeLevel}); alumniBday=${s.alumniBday} strayBday=${s.strayBday}`,
    );
  }

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1 → no changes made.");
    return;
  }
  if (strays.length === 0) {
    console.log("\nNothing to clean.");
    return;
  }

  let removedEdu = 0;
  let removedLogs = 0;
  let removedChanges = 0;
  for (const s of strays) {
    // Graduation log for this degree: SYSTEM, resource education, details.studentId.
    const logs = await prisma.activityLog.findMany({
      where: {
        alumniId: s.alumniId,
        actorType: "SYSTEM",
        resource: "education",
      },
      select: { id: true, details: true },
    });
    const logIds = logs
      .filter((l) => (l.details as { studentId?: string } | null)?.studentId === s.studentId)
      .map((l) => l.id);

    if (logIds.length) {
      const delChanges = await prisma.fieldChangeHistory.deleteMany({
        where: { activityLogId: { in: logIds } },
      });
      const delLogs = await prisma.activityLog.deleteMany({ where: { id: { in: logIds } } });
      removedChanges += delChanges.count;
      removedLogs += delLogs.count;
    }
    await prisma.education.delete({ where: { id: s.educationId } });
    removedEdu++;
    // Highest degree may have changed → re-sync the current name.
    await syncNameFromHighestDegree(s.alumniId).catch(() => null);
  }

  console.log(
    `\nRemoved ${removedEdu} stray education(s), ${removedLogs} graduation log(s), ${removedChanges} field-change row(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

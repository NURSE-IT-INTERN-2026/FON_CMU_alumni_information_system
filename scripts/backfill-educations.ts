/**
 * Backfill the new `education` table from each (non-deleted) alumni's existing
 * degree snapshot, and point `alumni.primaryEducationId` at it. Idempotent —
 * safe to re-run: an alumni that already has an education row for its
 * degreeLevel (and a primaryEducationId) is left untouched.
 *
 * After this, every active alumni has ≥1 Education row (its primary) mirroring
 * the denormalized snapshot, so the "switch degree" UI has something to show
 * and the snapshot↔primary invariant holds from the start.
 *
 * Run with:
 *   node --env-file=.env --import tsx scripts/backfill-educations.ts
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/backfill-educations.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";

const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  const alumni = await prisma.alumni.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      studentId: true,
      degreeLevel: true,
      graduationYear: true,
      major: true,
      cohort: true,
      primaryEducationId: true,
      educations: { select: { id: true, degreeLevel: true } },
    },
  });

  let created = 0;
  let skipped = 0;
  let linkedPrimary = 0;

  for (const a of alumni) {
    const existing = a.educations.find((e) => e.degreeLevel === a.degreeLevel);
    let primaryId = a.primaryEducationId;

    if (!existing) {
      if (!DRY_RUN) {
        const row = await prisma.education.create({
          data: {
            alumniId: a.id,
            studentId: a.studentId,
            degreeLevel: a.degreeLevel,
            graduationYear: a.graduationYear,
            major: a.major,
            cohort: a.cohort,
          },
        });
        primaryId = row.id;
      }
      created++;
    } else {
      // Education row already exists for this degree — just reuse it as primary
      // if no primary is set yet.
      primaryId ??= existing.id;
      skipped++;
    }

    if (primaryId && primaryId !== a.primaryEducationId) {
      if (!DRY_RUN) {
        await prisma.alumni.update({
          where: { id: a.id },
          data: { primaryEducationId: primaryId },
        });
      }
      linkedPrimary++;
    }
  }

  console.log(`Alumni scanned: ${alumni.length}`);
  console.log(`Education rows created: ${created}`);
  console.log(`Skipped (already had matching education): ${skipped}`);
  console.log(`primaryEducationId set: ${linkedPrimary}`);
  if (DRY_RUN) console.log("(DRY_RUN — no writes performed)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

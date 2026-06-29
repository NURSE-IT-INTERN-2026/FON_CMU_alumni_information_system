/**
 * Backfill the `education` table from each (non-deleted) alumni's existing
 * degree snapshot, and point `alumni.primaryEducationId` at it. Idempotent and
 * safe to re-run: it simply applies `ensurePrimaryEducationFromSnapshot` to
 * every active alumni, which is a no-op once a valid primary Education row
 * exists.
 *
 * After this, every active alumni has ≥1 Education row (its primary) mirroring
 * the denormalized snapshot — so the profile "ประวัติการศึกษา" section
 * (`EducationSection`) is never empty for an alumni that plainly has a degree
 * (which the all-alumni table shows from the CMU merge), and the
 * snapshot↔primary invariant holds.
 *
 * This is the same helper the alumni-creation paths (import, `ensureAlumni`,
 * create-with-related, base POST) call, so this script is just the one-time
 * catch-up for records created before that wiring existed.
 *
 * Run with:
 *   node --env-file=.env --import tsx scripts/backfill-educations.ts
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/backfill-educations.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import { ensurePrimaryEducationFromSnapshot } from "@/lib/education-sync";

const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  const alumni = await prisma.alumni.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      primaryEducationId: true,
      educations: { select: { id: true } },
    },
  });

  // Only alumni with no valid primary need work — count them up front so the
  // dry-run preview is accurate and we skip the helper's query for the rest.
  const needsFix = alumni.filter(
    (a) =>
      !a.primaryEducationId ||
      !a.educations.some((e) => e.id === a.primaryEducationId),
  );

  let created = 0;
  let linkedPrimary = 0;

  for (const a of needsFix) {
    const hadRows = a.educations.length > 0;
    if (!DRY_RUN) {
      await ensurePrimaryEducationFromSnapshot(a.id);
    }
    if (hadRows) linkedPrimary++;
    else created++;
  }

  console.log(`Active alumni scanned: ${alumni.length}`);
  console.log(`Already had a valid primary (skipped): ${alumni.length - needsFix.length}`);
  console.log(`Education rows created from snapshot: ${created}`);
  console.log(`Existing row adopted as primary: ${linkedPrimary}`);
  if (DRY_RUN) console.log("(DRY_RUN — no writes performed)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

/**
 * One-off backfill (DELETE after running): correct education SYSTEM graduation
 * logs whose `createdAt` was backdated to a Buddhist year treated as CE (year
 * ~2524, i.e. ~500 years in the future) because they had no CMU `grad_date` and
 * fell back to `yearToDate(graduationYear)` BEFORE the Buddhist→CE fix in
 * lib/graduation-log.ts. Recomputes each from the education row's Buddhist
 * `graduationYear` (−543 → CE) and re-applies the same date to its linked
 * `field_change_history` rows (so the per-alumni timeline stays consistent).
 * Idempotent: logs already dated in a sane range (≤2100) are left untouched.
 *
 *   node --env-file=.env --import tsx scripts/fix-graduation-log-dates.ts
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/fix-graduation-log-dates.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";

const DRY_RUN = process.env.DRY_RUN === "1";

/** Match lib/graduation-log.ts yearToDate: Buddhist (>2400) → CE (−543). */
function ceYear(graduationYear: number): number {
  return graduationYear > 2400 ? graduationYear - 543 : graduationYear;
}

async function main() {
  const broken = await prisma.activityLog.findMany({
    where: {
      actorType: "SYSTEM",
      resource: "education",
      createdAt: { gt: new Date("2100-01-01T00:00:00Z") },
    },
    select: { id: true, details: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Found ${broken.length} future-dated education SYSTEM log(s).\n`);

  let fixed = 0;
  let skipped = 0;
  for (const log of broken) {
    const studentId = (log.details as { studentId?: string } | null)?.studentId;
    if (!studentId) {
      skipped++;
      console.log(`  SKIP ${log.id}: no studentId in details`);
      continue;
    }
    const edu = await prisma.education.findUnique({
      where: { studentId },
      select: { graduationYear: true },
    });
    if (!edu || !edu.graduationYear) {
      skipped++;
      console.log(`  SKIP ${log.id} (${studentId}): no education/graduationYear`);
      continue;
    }
    const ce = ceYear(edu.graduationYear);
    const at = new Date(ce, 0, 1); // Jan 1 of the CE year (matches yearToDate)
    console.log(
      `  ${DRY_RUN ? "[dry]" : "[fix]"} ${log.id} student=${studentId} ` +
        `gradYr=${edu.graduationYear} → CE ${ce} (${at.toISOString()}) [was ${log.createdAt.toISOString()}]`,
    );
    if (DRY_RUN) {
      fixed++;
      continue;
    }
    const fc = await prisma.$transaction([
      prisma.activityLog.update({ where: { id: log.id }, data: { createdAt: at } }),
      prisma.fieldChangeHistory.updateMany({
        where: { activityLogId: log.id },
        data: { createdAt: at },
      }),
    ]);
    console.log(`        → field_change rows updated: ${fc[1].count}`);
    fixed++;
  }
  console.log(`\n${DRY_RUN ? "Would fix" : "Fixed"} ${fixed}, skipped ${skipped}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

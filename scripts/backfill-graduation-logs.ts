/**
 * One-off backfill: generate SYSTEM graduation activity logs for every local
 * (non-deleted) alumni from their Education rows (CMU `grad_date` for ordering).
 * Idempotent — `generateGraduationLogs` skips degrees already logged.
 *
 *   node --env-file=.env --import tsx scripts/backfill-graduation-logs.ts
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/backfill-graduation-logs.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import { generateGraduationLogs } from "@/lib/graduation-log";

const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  const alumni = await prisma.alumni.findMany({
    where: { deletedAt: null },
    select: { id: true, _count: { select: { educations: true } } },
  });
  const degreeTotal = alumni.reduce((n, a) => n + a._count.educations, 0);
  console.log(
    DRY_RUN
      ? `DRY RUN — ${alumni.length} alumni, ${degreeTotal} education rows (would log the un-logged ones)`
      : `LIVE — generating graduation logs for ${alumni.length} alumni`,
  );
  if (DRY_RUN) return;

  let created = 0;
  for (const a of alumni) {
    const before = await prisma.activityLog.count({
      where: { alumniId: a.id, actorType: "SYSTEM", resource: "education" },
    });
    await generateGraduationLogs(a.id);
    const after = await prisma.activityLog.count({
      where: { alumniId: a.id, actorType: "SYSTEM", resource: "education" },
    });
    created += Math.max(0, after - before);
  }
  console.log(`Generated ${created} new graduation logs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

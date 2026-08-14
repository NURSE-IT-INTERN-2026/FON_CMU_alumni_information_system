/**
 * One-time seed: materialize a COHORT CommunityGroup for every distinct cohort
 * value among opted-in alumni (community V2). Idempotent — ensureCohortGroup
 * finds-or-creates, so re-running is safe. New cohorts don't need this (the
 * join route lazily creates their group), but seeding gives every cohort a
 * discoverable group card from day one.
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/seed-cohort-groups.ts            # apply
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/seed-cohort-groups.ts  # preview
 */
import prisma from "../lib/prisma";
import { ensureCohortGroup, normalizeCohortKey } from "../lib/group-cohort";

async function main() {
  const dryRun = process.env.DRY_RUN === "1";

  const rows = await prisma.alumni.findMany({
    where: { deletedAt: null, communityOptedInAt: { not: null }, cohort: { not: null } },
    select: { cohort: true },
    distinct: ["cohort"],
  });
  const cohorts = rows
    .map((r) => r.cohort!)
    .map(normalizeCohortKey)
    .filter(Boolean);

  console.log(`Distinct cohorts among opted-in alumni: ${cohorts.length}${dryRun ? " (DRY RUN)" : ""}`);
  let created = 0;
  let existing = 0;
  for (const cohort of cohorts) {
    const before = await prisma.communityGroup.findFirst({
      where: { kind: "COHORT", cohortKey: cohort, deletedAt: null },
    });
    if (before) {
      existing++;
      continue;
    }
    if (!dryRun) {
      const group = await ensureCohortGroup(cohort);
      console.log(`  created: ${group.slug} — ${group.title}`);
    } else {
      console.log(`  would create: cohort-${cohort}`);
    }
    created++;
  }
  console.log(`Done. created=${created} existing=${existing}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

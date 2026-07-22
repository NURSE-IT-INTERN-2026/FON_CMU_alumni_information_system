/**
 * One-time backfill: link every "pending" related-entity row (Award, Association,
 * GraduateCommittee, Potential, ModelRepresentative, AlumniAgency whose
 * `pendingStudentId` is set) to an alumni whose `studentId` matches — applying
 * the SAME rules as the runtime auto-link (`autoLinkPendingForAlumni`): FK flip
 * + clear `pendingStudentId` + alumni-wins name overwrite + (agency only)
 * one-time homeAddress migration onto the alumni.
 *
 * Only ACTIVE alumni are considered (mirrors the runtime gate — signups link at
 * approve, so a REJECTED/UNVERIFIED/PENDING account's pending rows stay flagged
 * until that account is approved). Safe to re-run (idempotent: a second run
 * finds nothing to link).
 *
 *   node --env-file=.env --import tsx scripts/link-pending-records.ts
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/link-pending-records.ts
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import {
  autoLinkPendingForAlumni,
  type AutoLinkSummary,
  type LinkEntityKind,
} from "@/lib/alumni-link";

const DRY_RUN = process.env.DRY_RUN === "1";

const ENTITY_DELEGATES = [
  "award",
  "association",
  "graduateCommittee",
  "potential",
  "modelRepresentative",
  "alumniAgency",
] as const;

function emptyTotals(): Record<LinkEntityKind, number> {
  return {
    award: 0,
    association: 0,
    graduate_committee: 0,
    potential: 0,
    model_representative: 0,
    alumni_agency: 0,
  };
}

async function collectPendingStudentIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const delegate of ENTITY_DELEGATES) {
    const rows = await (prisma[delegate] as typeof prisma.award).findMany({
      where: { pendingStudentId: { not: null }, deletedAt: null },
      select: { pendingStudentId: true },
    });
    for (const r of rows) {
      const v = r.pendingStudentId;
      if (v) ids.add(v);
    }
  }
  return ids;
}

async function main() {
  const [activeAlumni, pendingIds] = await Promise.all([
    prisma.alumni.findMany({
      where: { deletedAt: null, accountStatus: "ACTIVE" },
      select: { id: true, studentId: true },
    }),
    collectPendingStudentIds(),
  ]);

  // Only alumni whose studentId actually has pending rows need processing —
  // skips the O(all-alumni) no-op scan.
  const toProcess = activeAlumni.filter((a) => pendingIds.has(a.studentId));

  console.log(
    `\n${DRY_RUN ? "[DRY RUN] " : ""}ACTIVE alumni: ${activeAlumni.length}; with pending rows to link: ${toProcess.length}`,
  );

  if (toProcess.length === 0) {
    console.log("Nothing to link.");
    return;
  }

  const totals = emptyTotals();
  let alumniTouched = 0;
  let homeMigrated = 0;

  for (const a of toProcess) {
    const summary: AutoLinkSummary = await autoLinkPendingForAlumni({
      alumniId: a.id,
      studentId: a.studentId,
      ctx: {
        actorType: "ADMIN",
        userId: "backfill",
        userEmail: "scripts/link-pending-records",
        userRole: "superadmin",
      },
      reason: "backfill",
      tx: prisma,
      dryRun: DRY_RUN,
    });
    if (summary.linkedCount > 0) {
      alumniTouched += 1;
      for (const kind of Object.keys(summary.perEntity) as LinkEntityKind[]) {
        totals[kind] += summary.perEntity[kind].flipped;
      }
    }
    if (summary.homeMigrated) homeMigrated += 1;
  }

  console.log(`\nLinked rows per entity:`);
  for (const kind of Object.keys(totals) as LinkEntityKind[]) {
    console.log(`  ${kind}: ${totals[kind]}`);
  }
  console.log(
    `Alumni touched: ${alumniTouched}; homeAddress migrations: ${homeMigrated}.`,
  );
  if (DRY_RUN) console.log("\nDRY_RUN=1 → no changes made. Re-run without DRY_RUN to apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

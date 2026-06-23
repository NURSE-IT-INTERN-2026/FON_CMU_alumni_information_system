/**
 * Verify the import run: for each of the 6 entities report how many rows have a
 * non-null `major` (the field we sync from CMU), plus a couple of sample rows.
 *
 * Run after importing the test files:
 *
 *   node --env-file=.env --import tsx scripts/verify-imports.ts
 */
import "dotenv/config";
import prisma from "../lib/prisma";

async function report<T extends { major: string | null }>(
  label: string,
  rows: T[],
  pick: (r: T) => string,
) {
  const total = rows.length;
  const withMajor = rows.filter((r) => r.major && r.major.trim() !== "").length;
  console.log(`\n=== ${label} ===`);
  console.log(`rows: ${total} | with major: ${withMajor}`);
  for (const r of rows.slice(0, 2)) {
    console.log(`  • ${pick(r)} → major: ${r.major ?? "(null)"}`);
  }
}

async function main() {
  console.log("Verifying import results...\n");

  const alumni = await prisma.alumni.findMany({
    where: { deletedAt: null },
    select: { studentId: true, firstName: true, lastName: true, major: true, degreeLevel: true, graduationYear: true },
  });
  const alumniWithMajor = alumni.filter((a) => a.major && a.major.trim() !== "").length;
  console.log(`=== Alumni (synced records) ===`);
  console.log(`rows: ${alumni.length} | with major: ${alumniWithMajor}`);
  for (const a of alumni.slice(0, 3)) {
    console.log(`  • ${a.studentId} ${a.firstName} ${a.lastName} → major: ${a.major ?? "(null)"} | degree: ${a.degreeLevel} | grad: ${a.graduationYear ?? "(null)"}`);
  }

  await report(
    "Associations",
    await prisma.association.findMany({ where: { deletedAt: null }, select: { studentId: true, prefix: true, firstName: true, lastName: true, major: true } }),
    (r) => `${r.studentId} ${[r.prefix, r.firstName, r.lastName].filter(Boolean).join(" ")}`,
  );
  await report(
    "Awards",
    await prisma.award.findMany({ where: { deletedAt: null }, select: { studentId: true, prefix: true, firstName: true, lastName: true, awardName: true, major: true } }),
    (r) => `${r.studentId ?? "(none)"} ${[r.prefix, r.firstName, r.lastName].filter(Boolean).join(" ")} — ${r.awardName}`,
  );
  await report(
    "Graduate Committee",
    await prisma.graduateCommittee.findMany({ where: { deletedAt: null }, select: { studentId: true, prefix: true, firstName: true, lastName: true, major: true } }),
    (r) => `${r.studentId} ${[r.prefix, r.firstName, r.lastName].filter(Boolean).join(" ")}`,
  );
  await report(
    "Model Representatives",
    await prisma.modelRepresentative.findMany({ where: { deletedAt: null }, select: { studentId: true, prefix: true, firstName: true, lastName: true, major: true } }),
    (r) => `${r.studentId} ${[r.prefix, r.firstName, r.lastName].filter(Boolean).join(" ")}`,
  );
  await report(
    "Potentials",
    await prisma.potential.findMany({ where: { deletedAt: null }, select: { studentId: true, prefix: true, firstName: true, lastName: true, major: true } }),
    (r) => `${r.studentId} ${[r.prefix, r.firstName, r.lastName].filter(Boolean).join(" ")}`,
  );
  await report(
    "Alumni Agency",
    await prisma.alumniAgency.findMany({ where: { deletedAt: null }, select: { studentId: true, prefix: true, firstName: true, lastName: true, major: true } }),
    (r) => `${r.studentId ?? "(none)"} ${[r.prefix, r.firstName, r.lastName].filter(Boolean).join(" ")}`,
  );

  console.log("");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Verify failed:", e);
  process.exit(1);
});

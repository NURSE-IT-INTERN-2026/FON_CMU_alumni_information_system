/**
 * Wipe all application data and re-seed ONLY the admin user accounts.
 *
 * Use this before testing imports so stale (out-of-sync) records don't
 * contaminate the result. Run with:
 *
 *   node --env-file=.env --import tsx scripts/reset-db.ts
 */
import "dotenv/config";
import prisma from "../lib/prisma";
import { hashPassword } from "../lib/auth";

async function main() {
  console.log("Resetting database...\n");

  // ── 1. Clear every table (dependency order: children before parents) ──
  console.log("Deleting all data...");
  await prisma.fieldChangeHistory.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.session.deleteMany();
  await prisma.alumniAgency.deleteMany();
  await prisma.modelRepresentative.deleteMany();
  await prisma.potential.deleteMany();
  await prisma.graduateCommittee.deleteMany();
  await prisma.association.deleteMany();
  await prisma.award.deleteMany();
  await prisma.news.deleteMany();
  await prisma.alumni.deleteMany();
  console.log("  All application data cleared\n");

  // ── 2. Re-seed admin users only (no sample alumni/awards/etc.) ──
  console.log("Upserting admin users...");
  const passwordHash = await hashPassword("password123");

  const [admin, superadmin] = await Promise.all([
    prisma.adminUser.upsert({
      where: { email: "admin@cmu.ac.th" },
      update: { firstName: "ผู้ดูแล", lastName: "ระบบ", passwordHash, role: "admin" },
      create: { firstName: "ผู้ดูแล", lastName: "ระบบ", email: "admin@cmu.ac.th", passwordHash, role: "admin" },
    }),
    prisma.adminUser.upsert({
      where: { email: "superadmin@cmu.ac.th" },
      update: { firstName: "ผู้ดูแลระบบ", lastName: "สูงสุด", passwordHash, role: "superadmin" },
      create: { firstName: "ผู้ดูแลระบบ", lastName: "สูงสุด", email: "superadmin@cmu.ac.th", passwordHash, role: "superadmin" },
    }),
  ]);

  console.log(`  ${admin.email} (admin)`);
  console.log(`  ${superadmin.email} (superadmin)\n`);
  console.log("Reset complete. Database now contains only the 2 admin users.");
}

main()
  .catch((e) => {
    console.error("Reset failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

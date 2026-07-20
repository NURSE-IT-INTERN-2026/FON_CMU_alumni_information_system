/**
 * Non-destructive seed for admin (system) users ONLY.
 *
 * Unlike `prisma/seed.ts`, this does NOT delete or touch any other data —
 * it is safe to run against a local DB that already holds real alumni records.
 * Use it to (re)create the two login accounts after a fresh DB / `migrate reset`
 * without wiping the rest of the data.
 *
 * Run: node --env-file=.env --import tsx scripts/seed-admin-users.ts
 *
 * Credentials (same as `prisma/seed.ts` §1):
 *   admin@cmu.ac.th      / password123  (role: admin)
 *   superadmin@cmu.ac.th / password123  (role: superadmin)
 *   executive@cmu.ac.th  / password123  (role: executive — read-only)
 */
import prisma from "../lib/prisma";
import { hashPassword } from "../lib/auth";

const ADMIN_PASSWORD = "password123";

const USERS = [
  {
    email: "admin@cmu.ac.th",
    firstName: "ผู้ดูแล",
    lastName: "ระบบ",
    role: "admin",
  },
  {
    email: "superadmin@cmu.ac.th",
    firstName: "ผู้ดูแลระบบ",
    lastName: "สูงสุด",
    role: "superadmin",
  },
  {
    email: "executive@cmu.ac.th",
    firstName: "ผู้บริหาร",
    lastName: "ระบบ",
    role: "executive",
  },
] as const;

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  for (const u of USERS) {
    const record = await prisma.adminUser.upsert({
      where: { email: u.email },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        passwordHash,
        isActive: true,
      },
      create: {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        passwordHash,
        isActive: true,
      },
    });
    const created = record.createdAt.getTime() === record.updatedAt.getTime() ? "created" : "updated";
    console.log(`  ✓ ${record.email.padEnd(22)} role=${record.role} (${created})`);
  }

  console.log(`\nDone. ${USERS.length} admin users upserted. Password for all: "${ADMIN_PASSWORD}"`);
}

main()
  .catch((e) => {
    console.error("Seeding admin users failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

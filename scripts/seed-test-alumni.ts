/**
 * Dev utility: seed (or reset) a local test alumni record for manual signup
 * testing. Re-running resets email/passwordHash so the signup flow can be
 * exercised again from scratch.
 *
 *   npx tsx scripts/seed-test-alumni.ts
 */
import "dotenv/config";
import prisma from "../lib/prisma";

// Easy-to-remember test identity (the 5 signup verification fields).
const TEST = {
  studentId: "1234567890",
  prefix: "นาย",
  firstName: "สมชาย",
  lastName: "ใจดี",
  cohort: "2560", // graduation year (Buddhist)
  birthDate: "01012540", // 1 Jan 2540 BE → 1997-01-01 (DDMMYYYY, Buddhist)
  degreeLevel: "BACHELOR" as const,
};

async function main() {
  const alumni = await prisma.alumni.upsert({
    where: { studentId: TEST.studentId },
    create: {
      ...TEST,
      email: null,
      passwordHash: null,
    },
    update: {
      prefix: TEST.prefix,
      firstName: TEST.firstName,
      lastName: TEST.lastName,
      cohort: TEST.cohort,
      birthDate: TEST.birthDate,
      degreeLevel: TEST.degreeLevel,
      // Reset so signup can be re-tested
      email: null,
      passwordHash: null,
      hasLoggedIn: false,
      lastLoginAt: null,
    },
    select: {
      id: true,
      studentId: true,
      prefix: true,
      firstName: true,
      lastName: true,
      cohort: true,
      birthDate: true,
      degreeLevel: true,
    },
  });

  console.log("Seeded test alumni:");
  console.log(JSON.stringify(alumni, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});

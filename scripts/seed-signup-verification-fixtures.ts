/**
 * Seed FOUR PENDING alumni accounts that exercise every admin-approval
 * "differences" scenario, so the review modal can be demonstrated end-to-end:
 *
 *   1) CMU record, submitted data MATCHES  → source=cmu,   all green
 *   2) CMU record, submitted data DIFFERS  → source=cmu,   red differences
 *   3) LOCAL alumni, submitted data MATCHES → source=local, all green
 *   4) LOCAL alumni, submitted data DIFFERS → source=local, red differences
 *
 * Mirrors `POST /api/alumni-auth/signup` exactly (CMU lookup →
 * `buildSignupVerification` → attach credentials + PENDING). Cases 3–4 pre-create
 * the authoritative local alumni first, then attach the signup — the path a real
 * local-existing-alumni signup takes.
 *
 * Idempotent: deletes any prior fixture alumni (by studentId) before re-creating.
 * Dev/test only — do not run against production.
 *
 *   node --env-file=.env --import tsx scripts/seed-signup-verification-fixtures.ts
 */
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import {
  buildSignupVerification,
  localAuthoritativeFromAlumni,
} from "@/lib/signup-verification";
import { Prisma, type DegreeLevel } from "@/app/generated/prisma/client";

const PASSWORD = "Test1234!";
type DL = "DOCTORAL" | "MASTER" | "BACHELOR" | "NURSING_ASSISTANT" | "ASSOCIATE";

interface Fixture {
  label: string;
  mode: "cmu" | "local";
  studentId: string;
  email: string;
  submitted: {
    firstName: string;
    lastName: string;
    birthDate: string; // Buddhist DDMMYYYY (form format)
    cohort: string;
    degreeLevel: DL;
  };
  authoritativeLocal?: {
    firstName: string;
    lastName: string;
    birthDate: string;
    cohort: string;
    degreeLevel: DL;
  };
}

const fixtures: Fixture[] = [
  {
    // CMU 571216554 พิชญ์สินี มีเจริญ (BACHELOR, b.14-10-1994 → BE 14102537, grad 2560)
    label: "1) CMU — match (green)",
    mode: "cmu",
    studentId: "571216554",
    email: "test.cmu.match@fon-cmu-alumni.test",
    submitted: { firstName: "พิชญ์สินี", lastName: "มีเจริญ", birthDate: "14102537", cohort: "2560", degreeLevel: "BACHELOR" },
  },
  {
    // CMU 591210106 พรไพลิน ดวงไทย (BACHELOR, b.03-12-1997 → BE 03122540, grad 2562);
    // applicant submits WRONG name/birthday/cohort/degree → mismatches
    label: "2) CMU — mismatch (red)",
    mode: "cmu",
    studentId: "591210106",
    email: "test.cmu.mismatch@fon-cmu-alumni.test",
    submitted: { firstName: "พรเพชร", lastName: "ดวงแก้ว", birthDate: "03012539", cohort: "2565", degreeLevel: "MASTER" },
  },
  {
    // LOCAL-only alumni (99000003); applicant submits the SAME identity → match
    label: "3) LOCAL — match (green)",
    mode: "local",
    studentId: "99000003",
    email: "test.local.match@fon-cmu-alumni.test",
    authoritativeLocal: { firstName: "ทดสอบ", lastName: "รุ่นที่สาม", birthDate: "15082535", cohort: "2558", degreeLevel: "BACHELOR" },
    submitted: { firstName: "ทดสอบ", lastName: "รุ่นที่สาม", birthDate: "15082535", cohort: "2558", degreeLevel: "BACHELOR" },
  },
  {
    // LOCAL-only alumni (99000004) identity = สมหญิง รักเรียน; applicant submits DIFFERENT → mismatch
    label: "4) LOCAL — mismatch (red)",
    mode: "local",
    studentId: "99000004",
    email: "test.local.mismatch@fon-cmu-alumni.test",
    authoritativeLocal: { firstName: "สมหญิง", lastName: "รักเรียน", birthDate: "01122540", cohort: "2560", degreeLevel: "BACHELOR" },
    submitted: { firstName: "สมชาย", lastName: "รักเล่น", birthDate: "01122539", cohort: "2561", degreeLevel: "MASTER" },
  },
];

async function cleanup() {
  const studentIds = fixtures.map((f) => f.studentId);
  const existing = await prisma.alumni.findMany({
    where: { studentId: { in: studentIds } },
    select: { id: true },
  });
  for (const a of existing) {
    await prisma.education.deleteMany({ where: { alumniId: a.id } }).catch(() => {});
  }
  const del = await prisma.alumni.deleteMany({ where: { studentId: { in: studentIds } } });
  console.log(`cleanup: removed ${del.count} prior fixture alumni`);
}

async function main() {
  await cleanup();
  const passwordHash = await hashPassword(PASSWORD);
  const report: Array<Record<string, unknown>> = [];

  for (const fx of fixtures) {
    // CMU lookup (mirrors the signup route).
    let cmuGrad = null;
    let cmuConsulted = false;
    try {
      cmuGrad = await fetchCmuGraduateById(fx.studentId);
      cmuConsulted = true;
    } catch {
      cmuConsulted = false;
    }

    if (fx.mode === "local") {
      // Pre-create the local alumni with the AUTHORITATIVE identity (no creds yet).
      await prisma.alumni.create({
        data: {
          studentId: fx.studentId,
          prefix: "-",
          firstName: fx.authoritativeLocal!.firstName,
          lastName: fx.authoritativeLocal!.lastName,
          birthDate: fx.authoritativeLocal!.birthDate,
          cohort: fx.authoritativeLocal!.cohort,
          degreeLevel: fx.authoritativeLocal!.degreeLevel as DegreeLevel,
        },
      });
    }

    // (Re)fetch the local alumni if it exists (mirrors the route's localAlumni lookup).
    const localAlumni = await prisma.alumni.findUnique({
      where: { studentId: fx.studentId },
    });

    const verification = buildSignupVerification(
      { studentId: fx.studentId, ...fx.submitted },
      cmuGrad,
      cmuConsulted,
      localAlumni ? localAuthoritativeFromAlumni(localAlumni) : null,
    );

    if (localAlumni) {
      // Local-existing branch: attach credentials + PENDING, identity preserved.
      await prisma.alumni.update({
        where: { id: localAlumni.id },
        data: {
          email: fx.email,
          passwordHash,
          accountStatus: "PENDING",
          signupVerification: verification as unknown as Prisma.InputJsonValue,
        },
      });
    } else {
      // Fresh-create branch (CMU case): identity from submitted data.
      await prisma.alumni.create({
        data: {
          studentId: fx.studentId,
          prefix: "-",
          firstName: fx.submitted.firstName,
          lastName: fx.submitted.lastName,
          birthDate: fx.submitted.birthDate,
          cohort: fx.submitted.cohort,
          degreeLevel: fx.submitted.degreeLevel as DegreeLevel,
          email: fx.email,
          passwordHash,
          accountStatus: "PENDING",
          signupVerification: verification as unknown as Prisma.InputJsonValue,
        },
      });
    }

    report.push({
      label: fx.label,
      studentId: fx.studentId,
      source: verification.source,
      allMatch: verification.allMatchableMatch,
      mismatches: Object.values(verification.fields).filter((f) => f.match === false).length,
    });
  }

  console.table(report);
  console.log(`\nAll 4 fixtures created as PENDING. Password for each: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

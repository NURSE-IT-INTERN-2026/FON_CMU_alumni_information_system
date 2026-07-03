/**
 * Dev seed: populate the alumni-related mock data for the local test alumni
 * `studentId = 12345678` so that EVERY alumni-related page/section renders
 * representative content — the management tables (associations, graduate-committee,
 * potentials, model-representatives, alumni-agency Thailand + abroad tabs) and the
 * related sections on both the admin profile (`/management/alumni/12345678`) and the
 * alumni-self profile (`/graduates/profile`).
 *
 * Awards + educations already exist for this alumni (hand-created) and are left
 * untouched. This script fills: the ข้อมูลติดต่อ contact fields on `Alumni`, plus
 * associations / graduateCommittees / potentials / modelRepresentatives / alumniAgency.
 *
 * Idempotent & deterministic: for each of the 5 related tables it `deleteMany`s the
 * rows owned by this studentId, then `createMany`s the mock set — so re-running resets
 * ONLY this alumni's rows in those tables (other alumni, and this alumni's awards/
 * educations, are never touched). The delete also clears any same-name `studentId IS
 * NULL` orphans (defensive — see the pitfall below). The contact update is a plain
 * `update`.
 *
 *   node --env-file=.env --import tsx scripts/seed-mock-alumni-12345678.ts
 *
 * (Same convention as scripts/seed-test-alumni.ts and scripts/seed-news-examples.ts —
 * direct Prisma, no activity-log write for a dev seed.)
 *
 * PITFALL: every related model's `studentId` is `String?` (nullable, FK to Alumni). A
 * `createMany` row that omits `studentId` inserts with `studentId = NULL` — Prisma still
 * reports the count, but the row is orphaned (not linked to the alumni) and invisible to
 * every studentId-scoped query + the profile pages. Always spread `base` (which carries
 * `studentId`) into each row.
 */
import "dotenv/config";
import prisma from "../lib/prisma";
import { MODEL_REP_NETWORKS } from "../lib/constants";

const STUDENT_ID = "12345678";

async function main() {
  const alumni = await prisma.alumni.findUnique({
    where: { studentId: STUDENT_ID },
    select: { id: true, prefix: true, firstName: true, lastName: true, cohort: true, degreeLevel: true },
  });
  if (!alumni) {
    throw new Error(
      `Alumni with studentId "${STUDENT_ID}" not found. Create it first (e.g. via scripts/seed-test-alumni.ts or the app).`,
    );
  }
  // `base` carries the FK `studentId` (load-bearing — see PITFALL above) + the alumni's
  // own name, so every createMany row is linked AND self-describing (the create routes
  // auto-fill the name; we set it explicitly for direct inserts).
  const base = { studentId: STUDENT_ID, prefix: alumni.prefix, firstName: alumni.firstName, lastName: alumni.lastName };
  // Delete predicate: linked rows for this alumni OR same-name NULL-studentId orphans.
  const ownedOrOrphan = { OR: [{ studentId: STUDENT_ID }, { studentId: null, firstName: alumni.firstName, lastName: alumni.lastName }] };
  console.log(`Seeding mock data for alumni ${STUDENT_ID} (${base.prefix} ${base.firstName} ${base.lastName})…\n`);

  // ── Contact info on the Alumni record (ข้อมูลติดต่อ) ──────────────────────────
  // Does NOT touch email/passwordHash (the auth identity).
  await prisma.alumni.update({
    where: { studentId: STUDENT_ID },
    data: {
      contactEmail: "polnapak.contact@example.com",
      phones: ["081-234-5678", "053-944-5555"],
      homeAddress: "123 หมู่บ้านพยาบาล ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200",
    },
  });
  console.log("  ✓ contact: contactEmail + 2 phones + homeAddress");

  // ── associations (สมาคม/ชมรม) ────────────────────────────────────────────────
  await prisma.association.deleteMany({ where: ownedOrOrphan });
  const assocCreated = await prisma.association.createMany({
    data: [
      { ...base, associationName: "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่", position: "ประธาน", recordedYear: 2568 },
      { ...base, associationName: "สมาคมพยาบาลแห่งประเทศไทย", position: "กรรมการ", recordedYear: 2567 },
      { ...base, associationName: "ชมรมพยาบาลภาคเหนือ", position: "เลขานุการ", recordedYear: 2566 },
    ],
  });
  console.log(`  ✓ associations: ${assocCreated.count}`);

  // ── graduateCommittees (กรรมการบัณฑิต) ──────────────────────────────────────
  // cohort = รุ่นที่ (string) here — NOT เครือข่าย (that inversion is model-representatives only).
  await prisma.graduateCommittee.deleteMany({ where: ownedOrOrphan });
  const commCreated = await prisma.graduateCommittee.createMany({
    data: [
      { ...base, termYear: 2568, cohort: "25", position: "ประธานกรรมการ", remarks: "คุณสมบัติและหลักฐานสำคัญ" },
      { ...base, termYear: 2567, cohort: "24", position: "กรรมการ", remarks: "" },
    ],
  });
  console.log(`  ✓ graduateCommittees: ${commCreated.count}`);

  // ── potentials (ศักยภาพ/ศิษย์เก่าดีเด่น) ────────────────────────────────────
  await prisma.potential.deleteMany({ where: ownedOrOrphan });
  const potCreated = await prisma.potential.createMany({
    data: [
      { ...base, career: "อาจารย์พยาบาล", position: "ผู้ช่วยศาสตราจารย์", recordedYear: 2568 },
      { ...base, career: "ผู้บริหารโรงพยาบาล", position: "ผู้อำนวยการการพยาบาล", recordedYear: 2566 },
    ],
  });
  console.log(`  ✓ potentials: ${potCreated.count}`);

  // ── modelRepresentatives (ตัวแทนรุ่น) ───────────────────────────────────────
  // On THIS model: cohort = เครือข่าย, generation = รุ่นที่ (Int) — inverted vs siblings.
  // Pick the network matching the primary degree (MASTER → ปริญญาโท).
  const network =
    alumni.degreeLevel === "MASTER" ? "ปริญญาโท"
    : alumni.degreeLevel === "DOCTORAL" ? "ปริญญาเอก"
    : MODEL_REP_NETWORKS[0]; // sensible default
  await prisma.modelRepresentative.deleteMany({ where: ownedOrOrphan });
  const repCreated = await prisma.modelRepresentative.createMany({
    data: [
      { ...base, cohort: network, generation: 25 },
    ],
  });
  console.log(`  ✓ modelRepresentatives: ${repCreated.count} (เครือข่าย "${network}")`);

  // ── alumniAgency (ข้อมูลการทำงานศิษย์เก่า: Thailand + abroad tabs) ──────────
  // Two rows so BOTH tabs populate: a Thailand-valued country → in-country tab,
  // a foreign country → abroad tab (split by isThailandCountry in lib/alumni-agency-region).
  await prisma.alumniAgency.deleteMany({ where: ownedOrOrphan });
  const agencyCreated = await prisma.alumniAgency.createMany({
    data: [
      {
        ...base,
        order: 1,
        cohort: "25",
        englishName: "Polnapak Jantree",
        workplace: "โรงพยาบาลมหาราชนครเชียงใหม่ คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่",
        homeAddress: "110 อ.เมือง จ.เชียงใหม่",
        country: "ประเทศไทย",
        notes: "หัวหน้าหน่วยพยาบาลระบบคลินิก",
      },
      {
        ...base,
        order: 2,
        cohort: "25",
        englishName: "Polnapak Jantree",
        workplace: "Mayo Clinic, Rochester, Minnesota, USA",
        homeAddress: "",
        country: "สหรัฐอเมริกา",
        notes: "Nurse Researcher, Division of Nursing Research",
      },
    ],
  });
  console.log(`  ✓ alumniAgency: ${agencyCreated.count} (1 Thailand + 1 abroad)`);

  // ── Final summary (DB counts for this alumni) ───────────────────────────────
  console.log("\nFinal DB counts for alumni " + STUDENT_ID + ":");
  const [assoc, comm, pot, rep, agency] = await Promise.all([
    prisma.association.count({ where: { studentId: STUDENT_ID } }),
    prisma.graduateCommittee.count({ where: { studentId: STUDENT_ID } }),
    prisma.potential.count({ where: { studentId: STUDENT_ID } }),
    prisma.modelRepresentative.count({ where: { studentId: STUDENT_ID } }),
    prisma.alumniAgency.count({ where: { studentId: STUDENT_ID } }),
  ]);
  console.log(`    associations=${assoc}  committees=${comm}  potentials=${pot}  modelReps=${rep}  alumniAgency=${agency}`);
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

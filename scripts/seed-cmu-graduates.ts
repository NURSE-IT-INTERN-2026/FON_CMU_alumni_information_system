/**
 * One-off / dev seed: materialize the CMU Registrar graduate list into the local
 * `cmu_graduates` table. Equivalent to clicking "ดึงข้อมูล" on /management/settings/cmu-sync,
 * but runnable from the CLI — to prime a fresh DB, or when you'd rather not drive
 * the UI. Requires the CMU env vars and a reachable Registrar.
 *
 *   node --env-file=.env --import tsx scripts/seed-cmu-graduates.ts
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/seed-cmu-graduates.ts   # preview only
 *
 * Mirrors POST /api/cmu-alumni/sync's upsert logic (chunked transactions so
 * existing rows refresh stale fields).
 */
import "dotenv/config";
import prisma from "../lib/prisma";
import { fetchCmuGraduatesLive, type CmuGraduate } from "../lib/cmu-registrar";

const CHUNK = 500;
const DRY_RUN = process.env.DRY_RUN === "1";

/** The 11 CMU fields persisted per record (mirrors the sync route). */
function rowFields(g: CmuGraduate) {
  return {
    nameTh: (g.name_th ?? "").trim(),
    surnameTh: (g.surname_th ?? "").trim(),
    birthday: g.birthday ?? "",
    levelId: g.level_id ?? "",
    majorNameTh: (g.major_name_th ?? "").trim(),
    gradYear: g.grad_year ?? "",
    sexId: g.sex_id || null,
    cmuitAccount: g.cmuitaccount || null,
    nameEn: g.name_en || null,
    surnameEn: g.surname_en || null,
    gradDate: g.grad_date || null,
  };
}

(async () => {
  const t0 = Date.now();
  console.log(DRY_RUN ? "[DRY_RUN] previewing CMU materialization..." : "Materializing CMU graduates...");
  const remote = await fetchCmuGraduatesLive();
  console.log(`Fetched ${remote.length.toLocaleString()} FON graduates from the registrar in ${Date.now() - t0}ms`);

  if (DRY_RUN) {
    console.log(`[DRY_RUN] would upsert ${remote.length.toLocaleString()} rows into cmu_graduates. Exiting without writing.`);
    await prisma.$disconnect();
    return;
  }

  let created = 0;
  let updated = 0;
  for (let i = 0; i < remote.length; i += CHUNK) {
    const slice = remote.slice(i, i + CHUNK);
    await prisma.$transaction(async (tx) => {
      for (const g of slice) {
        const sid = String(g.student_id ?? "").trim();
        if (!sid) continue;
        const result = await tx.cmuGraduate.upsert({
          where: { studentId: sid },
          create: { studentId: sid, ...rowFields(g) },
          update: { ...rowFields(g), deletedAt: null },
        });
        if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
        else updated++;
      }
    });
    if (((i / CHUNK) | 0) % 10 === 0) {
      console.log(`  ...${Math.min(i + CHUNK, remote.length).toLocaleString()}/${remote.length.toLocaleString()}`);
    }
  }

  console.log(`Done in ${Date.now() - t0}ms — created ${created.toLocaleString()}, updated ${updated.toLocaleString()}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("seed-cmu-graduates failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});

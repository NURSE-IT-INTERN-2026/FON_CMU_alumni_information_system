/**
 * Demonstrate the backfill-only sync guarantee: importing over an alumni row
 * whose fields an admin already edited must NOT clobber those edits, while any
 * empty field is still backfilled from CMU.
 *
 * It runs the REAL import endpoint (associations) over a pre-edited row, then
 * restores the row and deletes the throwaway association it created. Requires
 * the dev server on http://localhost:3000 and CMU-synced alumni data already
 * imported (run build-test-imports + the imports first).
 *
 *   node --env-file=.env --import tsx scripts/test-backfill.ts
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import prisma from "../lib/prisma";
import { getCmuLookupMap } from "../lib/ensure-alumni";

const BASE = "http://localhost:3000/alumni/api";
const SENTINEL_MAJOR = "สาขาที่ผู้ดูแลแก้ไขเอง (ทดสอบ)";
const SENTINEL_FIRST = "ชื่อที่ผู้ดูแลแก้";
const TEST_ASSOC = "สมาคมทดสอบการเขียนทับ";

interface ImportResponse {
  imported?: number;
  errors?: unknown[];
  error?: string;
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@cmu.ac.th", password: "password123" }),
  });
  if (!res.ok) throw new Error(`login failed (${res.status}) — is the dev server running on :3000?`);
  const sc = res.headers.get("set-cookie");
  if (!sc) throw new Error("login returned no session cookie");
  return sc.split(";")[0];
}

async function buildOneRowXlsx(studentId: string, fullName: string): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(["รหัสนักศึกษา", "ชื่อ-สกุล", "ชื่อสมาคม/ชมรม", "ตำแหน่ง", "ปีที่บันทึก (พ.ศ.)"]);
  ws.addRow([studentId, fullName, TEST_ASSOC, "ทดสอบย้อนกลับ", 2599]);
  const path = "/tmp/backfill-test.xlsx";
  await wb.xlsx.writeFile(path);
  return path;
}

async function importRow(cookie: string, filePath: string): Promise<ImportResponse> {
  const buf = await readFile(filePath);
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "backfill-test.xlsx",
  );
  const res = await fetch(`${BASE}/associations/import`, {
    method: "POST",
    headers: { cookie },
    body: fd,
  });
  return (await res.json()) as ImportResponse;
}

async function main() {
  const target = await prisma.alumni.findFirst({
    where: { deletedAt: null, major: { not: null } },
    select: { id: true, studentId: true, firstName: true, major: true, englishName: true },
  });
  if (!target) {
    console.error("No CMU-synced alumni found — run build-test-imports + the imports first.");
    process.exit(1);
  }
  const cmu = (await getCmuLookupMap()).get(target.studentId.trim());
  if (!cmu) {
    console.error(`Target ${target.studentId} has no CMU match — pick an imported row.`);
    process.exit(1);
  }
  const cmuEnglish = [cmu.name_en, cmu.surname_en]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");

  console.log(`Target alumni: ${target.studentId} (firstName: ${target.firstName})`);
  console.log(`CMU major for this student: ${target.major}\n`);

  const orig = { major: target.major, firstName: target.firstName, englishName: target.englishName };
  let passed = true;
  const expect = (label: string, cond: boolean) => {
    console.log(`  ${cond ? "✓ PASS" : "✗ FAIL"} — ${label}`);
    if (!cond) passed = false;
  };

  // 1. Simulate an admin edit: overwrite major + firstName, clear englishName.
  await prisma.alumni.update({
    where: { id: target.id },
    data: { major: SENTINEL_MAJOR, firstName: SENTINEL_FIRST, englishName: null },
  });
  console.log(`Admin edit applied → major: "${SENTINEL_MAJOR}", firstName: "${SENTINEL_FIRST}", englishName: null`);

  try {
    // 2. Import a row targeting this same alumni (runs the CMU sync per row).
    const cookie = await login();
    const fp = await buildOneRowXlsx(target.studentId, `${SENTINEL_FIRST} ทดสอบ`);
    const imp = await importRow(cookie, fp);
    console.log(`Import response: ${JSON.stringify(imp)}`);
    if (imp.imported !== 1) {
      console.error("  ⚠ expected imported=1; the backfill sync still ran before the create.");
    }

    // 3. Reload and assert.
    const after = await prisma.alumni.findUnique({ where: { id: target.id } });
    if (!after) throw new Error("alumni vanished during test");
    console.log("\nAfter re-import:");
    console.log(`  major:       ${after.major}`);
    console.log(`  firstName:   ${after.firstName}`);
    console.log(`  englishName: ${after.englishName ?? "(null)"}`);
    console.log("");
    expect("admin-edited major preserved (NOT clobbered)", after.major === SENTINEL_MAJOR);
    expect("admin-edited firstName preserved (NOT clobbered)", after.firstName === SENTINEL_FIRST);
    expect("empty englishName backfilled from CMU", !!after.englishName && after.englishName.length > 0);
    if (cmuEnglish) {
      expect(`englishName matches CMU ("${cmuEnglish}")`, after.englishName === cmuEnglish);
    }
  } finally {
    // 4. Restore the alumni row and remove the throwaway association.
    await prisma.alumni.update({
      where: { id: target.id },
      data: { major: orig.major, firstName: orig.firstName, englishName: orig.englishName },
    });
    await prisma.association.deleteMany({ where: { associationName: TEST_ASSOC } });
    console.log(`\n(restored ${target.studentId}; deleted test association "${TEST_ASSOC}")`);
  }

  console.log(
    passed
      ? "\n✅ PASS — admin edits survived re-import; empty field was backfilled."
      : "\n❌ FAIL",
  );
  await prisma.$disconnect();
  process.exit(passed ? 0 : 1);
}

main().catch((e) => {
  console.error("Backfill test error:", e);
  process.exit(1);
});

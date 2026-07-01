/**
 * Generate test Excel imports for the 6 alumni data pages, using REAL student
 * ids pulled from the CMU Registrar API so the import-time CMU sync actually
 * fires (auto-filling `major`, degree level, etc.).
 *
 * Writes one .xlsx per page into imports/testing/. Run with:
 *
 *   node --env-file=.env --import tsx scripts/build-test-imports.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { fetchCmuGraduatesLive, type CmuGraduate } from "../lib/cmu-registrar";

const TESTING_DIR = "imports/testing";

// ---------------------------------------------------------------------------
// CMU pool — real student ids, trimmed & de-duplicated, one per major
// ---------------------------------------------------------------------------

async function buildPool(): Promise<CmuGraduate[]> {
  const grads = await fetchCmuGraduatesLive();
  const byId = new Map<string, CmuGraduate>();
  for (const g of grads) {
    const sid = String(g.student_id ?? "").trim();
    const major = (g.major_name_th ?? "").trim();
    if (!sid || !major) continue;
    if (!byId.has(sid)) byId.set(sid, g);
  }
  const all = [...byId.values()].sort((a, b) =>
    String(a.major_name_th).localeCompare(String(b.major_name_th), "th"),
  );
  // Pick one graduate per major for diversity (up to 15).
  const pool: CmuGraduate[] = [];
  const seen = new Set<string>();
  for (const g of all) {
    const m = String(g.major_name_th).trim();
    if (seen.has(m)) continue;
    seen.add(m);
    pool.push(g);
    if (pool.length >= 15) break;
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const thaiName = (g: CmuGraduate) =>
  [g.name_th, g.surname_th].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
const englishName = (g: CmuGraduate) =>
  [g.name_en, g.surname_en].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");

/** Map CMU level_id to the cohort label used on the model-representatives page. */
function cohortLabel(g: CmuGraduate): string {
  const lvl = String(g.level_id ?? "").trim();
  if (lvl === "5") return "ปริญญาเอก";
  if (lvl === "3") return "ปริญญาโท";
  if (lvl === "2") return "ผู้ช่วยพยาบาล";
  if (lvl === "1") return "ปริญญาพยาบาล";
  if (lvl === "0") {
    return String(g.major_name_th).includes("ผู้ช่วยพยาบาล")
      ? "ผู้ช่วยพยาบาล"
      : "อนุปริญญาพยาบาล";
  }
  return "ปริญญาพยาบาล";
}

async function writeSheet(
  fileName: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  const fullPath = path.join(TESTING_DIR, fileName);
  await wb.xlsx.writeFile(fullPath);
  console.log(`  ${fullPath} — ${rows.length} rows`);
}

// Fabricated domain data
const ASSOC_NAMES = [
  "สมาคมศิษย์เก่าคณะพยาบาลศาสตร์ มช.",
  "สมาคมพยาบาลแห่งประเทศไทย",
  "ชมรมพยาบาลภาคเหนือ",
];
const POSITIONS = ["ประธาน", "รองประธาน", "เลขานุการ", "กรรมการ", "ที่ปรึกษา"];
const AWARD_NAMES = [
  "รางวัลพยาบาลดีเด่นแห่งชาติ",
  "รางวัลนักวิจัยดีเด่นระดับนานาชาติ",
  "รางวัลอาจารย์คลินิกดีเด่น",
  "รางวัลผู้นำชุมชนดีเด่นระดับท้องถิ่น",
];
const AWARD_TYPES = ["รางวัลระดับนานาชาติ", "รางวัลระดับชาติ", "รางวัลระดับท้องถิ่น"];
const CAREERS = [
  "พยาบาลวิชาชีพ",
  "อาจารย์พยาบาล",
  "ผู้บริหารโรงพยาบาล",
  "นักวิจัยทางการพยาบาล",
];
const COMM_POSITIONS = ["ประธานกรรมการ", "กรรมการ", "เลขานุการกรรมการ", "ที่ปรึกษา"];
const ABROAD_SITES: { workplace: string; country: string }[] = [
  { workplace: "Mayo Clinic, Rochester, Minnesota, USA", country: "สหรัฐอเมริกา" },
  { workplace: "Royal Brisbane Hospital, Australia", country: "ออสเตรเลีย" },
  { workplace: "Toronto General Hospital, Canada", country: "แคนาดา" },
  { workplace: "National University Hospital, Singapore", country: "สิงคโปร์" },
  { workplace: "St. Mary's Hospital, London, UK", country: "อังกฤษ" },
];
const YEARS = [2567, 2568, 2569];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(TESTING_DIR, { recursive: true });
  fs.mkdirSync("imports/finalized", { recursive: true });

  console.log("Fetching real FON graduates from CMU Registrar...");
  const pool = await buildPool();
  console.log(`Selected ${pool.length} graduates (one per major)\n`);

  console.log("Writing test files to imports/testing/...");

  // 1. associations
  await writeSheet(
    "associations.xlsx",
    ["รหัสนักศึกษา", "ชื่อ-สกุล", "ชื่อสมาคม/ชมรม", "ตำแหน่ง", "ปีที่บันทึก (พ.ศ.)"],
    pool.map((g, i) => [
      String(g.student_id).trim(),
      thaiName(g),
      ASSOC_NAMES[i % ASSOC_NAMES.length],
      POSITIONS[i % POSITIONS.length],
      YEARS[i % YEARS.length],
    ]),
  );

  // 2. awards
  await writeSheet(
    "awards.xlsx",
    ["รหัสนักศึกษา", "ชื่อ-นามสกุล", "ชื่อรางวัล", "ประเภทรางวัล", "ปี (พ.ศ.)", "รายละเอียด"],
    pool.map((g, i) => [
      String(g.student_id).trim(),
      thaiName(g),
      AWARD_NAMES[i % AWARD_NAMES.length],
      AWARD_TYPES[i % AWARD_TYPES.length],
      YEARS[i % YEARS.length],
      "",
    ]),
  );

  // 3. graduate-committee
  await writeSheet(
    "graduate-committee.xlsx",
    ["ปี พ.ศ.", "รหัสนักศึกษา", "ชื่อ-สกุล", "รุ่นที่", "ตำแหน่ง", "หมายเหตุ"],
    pool.map((g, i) => [
      YEARS[i % YEARS.length],
      String(g.student_id).trim(),
      thaiName(g),
      String((i % 30) + 1),
      COMM_POSITIONS[i % COMM_POSITIONS.length],
      "",
    ]),
  );

  // 4. model-representatives
  await writeSheet(
    "model-representatives.xlsx",
    ["รหัสนักศึกษา", "ชื่อ-นามสกุล", "เครือข่าย", "ลำดับรุ่น"],
    pool.map((g, i) => [
      String(g.student_id).trim(),
      thaiName(g),
      cohortLabel(g),
      (i % 20) + 1,
    ]),
  );

  // 5. potentials
  await writeSheet(
    "potentials.xlsx",
    ["รหัสนักศึกษา", "ชื่อ-สกุล", "อาชีพ", "ตำแหน่ง", "ปีที่บันทึก (พ.ศ.)"],
    pool.map((g, i) => [
      String(g.student_id).trim(),
      thaiName(g),
      CAREERS[i % CAREERS.length],
      POSITIONS[i % POSITIONS.length],
      YEARS[i % YEARS.length],
    ]),
  );

  // 6. alumni-agency (export format + รหัสนักศึกษา column)
  await writeSheet(
    "alumni-agency.xlsx",
    [
      "ลำดับ",
      "คำนำหน้า",
      "ชื่อไทย",
      "ชื่ออังกฤษ",
      "สถานที่ทำงาน",
      "ที่อยู่บ้าน",
      "ประเทศ",
      "หมายเหตุ",
      "รุ่น",
      "รหัสนักศึกษา",
    ],
    pool.map((g, i) => {
      const site = ABROAD_SITES[i % ABROAD_SITES.length];
      return [
        i + 1,
        String(g.sex_id).trim() === "1" ? "นาย" : "นางสาว",
        thaiName(g),
        englishName(g),
        site.workplace,
        "",
        site.country,
        "",
        String((i % 30) + 1),
        String(g.student_id).trim(),
      ];
    }),
  );

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error("Build failed:", e);
    process.exit(1);
  })
  .finally(() => {});

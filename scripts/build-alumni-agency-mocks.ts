/**
 * Build TWO mock alumni-agency fixtures from the REAL abroad file
 * (imports/excels/alumni-agency.xlsx), each with realistic mock
 * `รหัสนักศึกษา` (studentId) + `สาขาวิชา` (major) filled in:
 *
 *   imports/excels/alumni-agency-mock.xlsx          — keeps the real abroad countries
 *   imports/excels/alumni-agency-thailand-mock.xlsx — `ประเทศ` overwritten with ประเทศไทย
 *
 * The mock studentIds are deliberately NOT in the real FON alumni universe, so
 * importing either file exercises the "no Alumni to link to" path: every row is
 * saved with `pendingStudentId` set (flagged รอเชื่อมโยง), `studentId` left null,
 * and NO stub Alumni is created. See app/api/alumni-agency/import/route.ts.
 *
 * The IDs are realistic FON bachelor-nursing codes (`<YY>1231<seq>`, the genuine
 * 1231 major code seen in real ids like 501231043 / 551231049 / 601231020),
 * deterministically generated and de-duplicated offline against the ~24k real
 * student ids so they never collide with a real person. Runs fully offline.
 *
 *   node --import tsx scripts/build-alumni-agency-mocks.ts
 */
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const OUT_DIR = "imports/excels";
const SOURCE = `${OUT_DIR}/alumni-agency.xlsx`;
const REAL_JSON = "imports/scrapped/alumni-data.json";
const REAL_ALUMNI_XLSX = `${OUT_DIR}/alumni.xlsx`;

const HEADERS = [
  "ลำดับ", "รุ่น", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่ออังกฤษ",
  "สถานที่ทำงาน", "ตำแหน่ง", "ที่อยู่บ้าน", "ประเทศ", "จังหวัด", "หมายเหตุ",
  "รหัสนักศึกษา", "สาขาวิชา",
] as const;

// Admission-year prefixes (Buddhist, 25xx). Skip 50/55/60 — they're the most
// densely used in the real data, so avoiding them minimizes collisions.
const YEARS = ["51", "52", "53", "54", "56", "57", "58", "59", "61", "62", "63", "64"];
const NURSING_CODE = "1231"; // real FON bachelor nursing major code

const MAJORS = [
  "พยาบาลศาสตร์",
  "การพยาบาล",
  "ผดุงครรภ์",
  "พยาบาลศาสตร์ (นานาชาติ)",
  "การพยาบาลและสุขภาพ",
  "พยาบาลศาสตร์มหาบัณฑิต",
  "สาธารณสุขศาสตร์",
];

// ตำแหน่ง (optional) — cycle a few realistic nursing positions across rows.
const POSITIONS = [
  "พยาบาลวิชาชีพ",
  "หัวหน้าหอผู้ป่วย",
  "ผู้ช่วยผู้อำนวยการฝ่ายการพยาบาล",
  "อาจารย์",
  "พยาบาลผู้ให้การปรึกษา",
  "",
];

// จังหวัด for the in-country (Thailand) fixture — cycle a spread of provinces.
const MOCK_PROVINCES = ["เชียงใหม่", "กรุงเทพมหานคร", "ขอนแก่น", "สงขลา", "นครราชสีมา", "อุบลราชธานี"];

// ---------------------------------------------------------------------------
// Readers / writers (mirror scripts/build-import-excels.ts helpers — duplicated
// here because that script runs its main() at import time)
// ---------------------------------------------------------------------------

async function readSheet(filePath: string): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });
  const rows: Record<string, string>[] = [];
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const obj: Record<string, string> = {};
    let has = false;
    headers.forEach((header, colNumber) => {
      if (!header) return;
      let v = row.getCell(colNumber).value ?? "";
      if (v && typeof v === "object" && "richText" in v) {
        v = (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
      }
      obj[header] = String(v).trim();
      if (obj[header]) has = true;
    });
    if (has) rows.push(obj);
  }
  return rows;
}

async function writeSheet(fileName: string, headers: readonly string[], rows: (string | number)[][]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow([...headers]);
  for (const r of rows) ws.addRow(r);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = 22;
  });
  await wb.xlsx.writeFile(path.join(OUT_DIR, fileName));
  console.log(`  ✓ ${fileName} — ${rows.length} rows`);
}

// ---------------------------------------------------------------------------
// Real studentId set (offline collision guard)
// ---------------------------------------------------------------------------

async function loadRealStudentIds(): Promise<Set<string>> {
  const set = new Set<string>();
  // alumni-data.json — array of { studentId, ... }
  if (fs.existsSync(REAL_JSON)) {
    const json = JSON.parse(fs.readFileSync(REAL_JSON, "utf8")) as Record<string, unknown>[];
    for (const r of json) {
      const s = String((r as { studentId?: unknown }).studentId ?? "").trim();
      if (s) set.add(s);
    }
  }
  // alumni.xlsx — col รหัสนักศึกษา
  if (fs.existsSync(REAL_ALUMNI_XLSX)) {
    const rows = await readSheet(REAL_ALUMNI_XLSX);
    for (const r of rows) {
      const s = (r["รหัสนักศึกษา"] ?? "").trim();
      if (s) set.add(s);
    }
  }
  return set;
}

let totalBumps = 0;

/** Deterministic, collision-free mock id for a 1-based row index. */
function mockStudentId(rowIndex: number, real: Set<string>, used: Set<string>): string {
  const yy = YEARS[(rowIndex - 1) % YEARS.length];
  let suffix = Math.floor((rowIndex - 1) / YEARS.length) + 1;
  let id = `${yy}${NURSING_CODE}${String(suffix).padStart(3, "0")}`;
  // Bump past any real id OR an already-generated mock id.
  while (real.has(id) || used.has(id)) {
    suffix += 1;
    id = `${yy}${NURSING_CODE}${String(suffix).padStart(3, "0")}`;
    totalBumps++;
  }
  used.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE} (run scripts/build-import-excels.ts first)`);
    process.exit(1);
  }

  const srcRows = await readSheet(SOURCE);
  console.log(`Source ${SOURCE}: ${srcRows.length} rows`);

  const real = await loadRealStudentIds();
  console.log(`Loaded ${real.size} real studentIds for collision guard`);
  const used = new Set<string>();

  const abroad: (string | number)[][] = [];
  const thailand: (string | number)[][] = [];
  const majorTally = new Map<string, number>();

  srcRows.forEach((r, idx) => {
    const rowIndex = idx + 1;
    const studentId = mockStudentId(rowIndex, real, used);
    const major = MAJORS[(rowIndex - 1) % MAJORS.length];
    majorTally.set(major, (majorTally.get(major) ?? 0) + 1);

    const cells = (country: string, province: string): (string | number)[] => [
      r["ลำดับ"] || rowIndex,
      r["รุ่น"] || "",
      r["คำนำหน้า"] || "",
      r["ชื่อ"] || "",
      r["นามสกุล"] || "",
      r["ชื่ออังกฤษ"] || "",
      r["สถานที่ทำงาน"] || "",
      POSITIONS[(rowIndex - 1) % POSITIONS.length],
      r["ที่อยู่บ้าน"] || "",
      country,
      province,
      r["หมายเหตุ"] || "",
      studentId,
      major,
    ];
    // Abroad rows carry no province; in-country rows cycle a realistic province.
    abroad.push(cells(r["ประเทศ"] || "สหรัฐอเมริกา", ""));
    thailand.push(cells("ประเทศไทย", MOCK_PROVINCES[(rowIndex - 1) % MOCK_PROVINCES.length]));
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("\nWriting mock fixtures:");
  await writeSheet("alumni-agency-mock.xlsx", HEADERS, abroad);
  await writeSheet("alumni-agency-thailand-mock.xlsx", HEADERS, thailand);

  console.log(`\n──────── SUMMARY ────────`);
  console.log(`  rows: ${srcRows.length}  |  first id: ${mockStudentId(1, real, new Set())} (per-year cohorts of ${NURSING_CODE})`);
  console.log(`  real-id collisions bumped past: ${totalBumps}`);
  console.log(`  major distribution:`);
  for (const [m, n] of [...majorTally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(4)}×  ${m}`);
  }
  console.log(`\nDone. Both files are ready — importing them flags every row รอเชื่อมโยง (no Alumni created).`);
}

main().catch((e) => {
  console.error("Build failed:", e);
  process.exit(1);
});

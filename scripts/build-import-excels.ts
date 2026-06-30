/**
 * Build clean, ready-to-import .xlsx files for every admin page that supports
 * Excel import, into imports/excels/ — one file per page, named after the
 * entity (matches the /api/{entity}/import route).
 *
 * Sources are the best available data already sitting under imports/
 * (the `finalized/` rebuild outputs + the abroad-alumni scrape). This script
 * only READS those sources and WRITES normalized copies — it never touches the
 * DB or the CMU Registrar API, so it runs fully offline and is safe to re-run.
 *
 * What "clean" means per file:
 *   - Combined-name columns (ชื่อ-สกุล / ชื่อไทย / ชื่อ-นามสกุล) are split into the
 *     canonical คำนำหน้า / ชื่อ / นามสกุล that every import parser prefers.
 *   - Required fields are validated against the SAME rules the import route
 *     enforces; rows that would fail import are dropped (and reported), so
 *     every row in the output is importable.
 *   - Enum-ish columns (award type, เครือข่าย network) are validated against
 *     their allowed value sets.
 *
 * alumni.xlsx is intentionally left untouched — it is the canonical full build
 * (see scripts/build-alumni-excel.ts) and already matches the import format.
 *
 *   node --env-file=.env --import tsx scripts/build-import-excels.ts
 */
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { splitFullName } from "../lib/parse-name";

const OUT_DIR = "imports/excels";

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/** Read an .xlsx's first sheet into header-keyed objects (mirrors readExcelRows). */
async function readSheet(
  filePath: string,
): Promise<Record<string, string>[]> {
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
        v = (v as { richText: { text: string }[] }).richText
          .map((r) => r.text)
          .join("");
      }
      obj[header] = String(v).trim();
      if (obj[header]) has = true;
    });
    if (has) rows.push(obj);
  }
  return rows;
}

/** Write a single-sheet .xlsx with frozen header + auto width. */
async function writeSheet(
  fileName: string,
  headers: string[],
  rows: (string | number)[][],
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = 22;
  });
  const full = path.join(OUT_DIR, fileName);
  await wb.xlsx.writeFile(full);
  console.log(`  ✓ ${fileName} — ${rows.length} rows`);
}

/** Coerce a cell to an int when it parses, else null. */
const toInt = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const str = (v: string | undefined): string => (v ?? "").trim();

// ---------------------------------------------------------------------------
// Allowed enum value sets (mirror lib/constants + the model-rep networks)
// ---------------------------------------------------------------------------

const VALID_AWARD_TYPES = new Set([
  "รางวัลระดับนานาชาติ",
  "รางวัลระดับชาติ",
  "รางวัลระดับท้องถิ่น",
]);

const VALID_NETWORKS = new Set([
  "ปริญญาพยาบาล",
  "ผู้ช่วยพยาบาล",
  "อนุปริญญาพยาบาล",
  "ปริญญาโท",
  "ปริญญาเอก",
]);

interface Report {
  file: string;
  source: string;
  inRows: number;
  outRows: number;
  dropped: { reason: string; count: number }[];
}

const reports: Report[] = [];
const drop = (
  r: Report,
  reason: string,
): void => {
  const found = r.dropped.find((d) => d.reason === reason);
  if (found) found.count++;
  else r.dropped.push({ reason, count: 1 });
};

// ---------------------------------------------------------------------------
// Per-entity builders
// ---------------------------------------------------------------------------

/** awards — source already has split คำนำหน้า/ชื่อ/นามสกุล; validate type + required. */
async function buildAwards(): Promise<void> {
  const src = "imports/finalized/awards.xlsx";
  const rows = await readSheet(src);
  const rep: Report = { file: "awards.xlsx", source: src, inRows: rows.length, outRows: 0, dropped: [] };
  const out: (string | number)[][] = [];
  for (const row of rows) {
    const firstName = str(row["ชื่อ"]);
    const lastName = str(row["นามสกุล"]);
    const awardName = str(row["ชื่อรางวัล"]);
    const awardType = str(row["ประเภทรางวัล"]);
    const year = toInt(row["ปี (พ.ศ.)"]);
    if (!firstName || !lastName || !awardName || !year) {
      drop(rep, "missing required (ชื่อ/นามสกุล/ชื่อรางวัล/ปี)");
      continue;
    }
    if (!VALID_AWARD_TYPES.has(awardType)) {
      drop(rep, `invalid award type "${awardType}"`);
      continue;
    }
    out.push([
      str(row["รหัสนักศึกษา"]),
      str(row["คำนำหน้า"]),
      firstName,
      lastName,
      str(row["สาขาวิชา"]),
      awardName,
      awardType,
      year,
      str(row["ลิงค์"]),
      str(row["รูปภาพ"]),
      str(row["รายละเอียด"]),
    ]);
  }
  rep.outRows = out.length;
  reports.push(rep);
  await writeSheet(
    "awards.xlsx",
    ["รหัสนักศึกษา", "คำนำหน้า", "ชื่อ", "นามสกุล", "สาขาวิชา", "ชื่อรางวัล", "ประเภทรางวัล", "ปี (พ.ศ.)", "ลิงค์", "รูปภาพ", "รายละเอียด"],
    out,
  );
}

/** Generic name-splitting builder for the three legacy ชื่อ-สกุล entities. */
async function buildSplitNameEntity(args: {
  file: string;
  source: string;
  headers: string[];
  /** map a parsed row → output cells, or null to drop (caller updates rep). */
  map: (row: Record<string, string>, names: { prefix: string; firstName: string; lastName: string }, rep: Report) => (string | number)[] | null;
}): Promise<void> {
  const rows = await readSheet(args.source);
  const rep: Report = { file: args.file, source: args.source, inRows: rows.length, outRows: 0, dropped: [] };
  const out: (string | number)[][] = [];
  for (const row of rows) {
    const legacy = str(row["ชื่อ-สกุล"]) || str(row["ชื่อ-นามสกุล"]);
    const n = splitFullName(legacy);
    const mapped = args.map(row, { prefix: n.prefix ?? "", firstName: n.firstName, lastName: n.lastName }, rep);
    if (mapped) out.push(mapped);
  }
  rep.outRows = out.length;
  reports.push(rep);
  await writeSheet(args.file, args.headers, out);
}

/** associations — split ชื่อ-สกุล; require studentId + name + assoc + position + year. */
async function buildAssociations(): Promise<void> {
  await buildSplitNameEntity({
    file: "associations.xlsx",
    source: "imports/finalized/associations.xlsx",
    headers: ["รหัสนักศึกษา", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่อสมาคม/ชมรม", "ตำแหน่ง", "ปีที่บันทึก (พ.ศ.)"],
    map: (row, n, rep) => {
      const studentId = str(row["รหัสนักศึกษา"]);
      const associationName = str(row["ชื่อสมาคม/ชมรม"]);
      const position = str(row["ตำแหน่ง"]);
      const year = toInt(row["ปีที่บันทึก (พ.ศ.)"]);
      if (!studentId || !n.firstName || !n.lastName || !associationName || !position || year == null) {
        drop(rep, "missing required field(s)");
        return null;
      }
      return [studentId, n.prefix, n.firstName, n.lastName, associationName, position, year];
    },
  });
}

/** graduate-committee — split ชื่อ-สกุล; require year + studentId + name + รุ่นที่ + position. */
async function buildGraduateCommittee(): Promise<void> {
  await buildSplitNameEntity({
    file: "graduate-committee.xlsx",
    source: "imports/finalized/graduate-committee.xlsx",
    headers: ["ปี พ.ศ.", "รหัสนักศึกษา", "คำนำหน้า", "ชื่อ", "นามสกุล", "รุ่นที่", "ตำแหน่ง", "หมายเหตุ"],
    map: (row, n, rep) => {
      const termYear = toInt(row["ปี พ.ศ."]);
      const studentId = str(row["รหัสนักศึกษา"]);
      const cohort = str(row["รุ่นที่"]);
      const position = str(row["ตำแหน่ง"]);
      if (termYear == null || !studentId || !n.firstName || !n.lastName || !cohort || !position) {
        drop(rep, "missing required field(s)");
        return null;
      }
      return [termYear, studentId, n.prefix, n.firstName, n.lastName, cohort, position, str(row["หมายเหตุ"])];
    },
  });
}

/** model-representatives — split ชื่อ-นามสกุล; require studentId + name + valid network + generation. */
async function buildModelRepresentatives(): Promise<void> {
  await buildSplitNameEntity({
    file: "model-representatives.xlsx",
    source: "imports/finalized/model-representatives.xlsx",
    headers: ["รหัสนักศึกษา", "คำนำหน้า", "ชื่อ", "นามสกุล", "เครือข่าย", "ลำดับรุ่น"],
    map: (row, n, rep) => {
      const studentId = str(row["รหัสนักศึกษา"]);
      const network = str(row["เครือข่าย"]);
      const generation = toInt(row["ลำดับรุ่น"]);
      if (!studentId || !n.firstName || !n.lastName || generation == null) {
        drop(rep, "missing required field(s)");
        return null;
      }
      if (!VALID_NETWORKS.has(network)) {
        drop(rep, `invalid network "${network}"`);
        return null;
      }
      return [studentId, n.prefix, n.firstName, n.lastName, network, generation];
    },
  });
}

/** potentials — split ชื่อ-สกุล; require studentId + name + career + position + year. */
async function buildPotentials(): Promise<void> {
  await buildSplitNameEntity({
    file: "potentials.xlsx",
    source: "imports/finalized/potentials.xlsx",
    headers: ["รหัสนักศึกษา", "คำนำหน้า", "ชื่อ", "นามสกุล", "อาชีพ", "ตำแหน่ง", "ปีที่บันทึก (พ.ศ.)"],
    map: (row, n, rep) => {
      const studentId = str(row["รหัสนักศึกษา"]);
      const career = str(row["อาชีพ"]);
      const position = str(row["ตำแหน่ง"]);
      const year = toInt(row["ปีที่บันทึก (พ.ศ.)"]);
      if (!studentId || !n.firstName || !n.lastName || !career || !position || year == null) {
        drop(rep, "missing required field(s)");
        return null;
      }
      return [studentId, n.prefix, n.firstName, n.lastName, career, position, year];
    },
  });
}

/** alumni-agency — 225-row abroad scrape; keep คำนำหน้า, split ชื่อไทย; require name + country. */
async function buildAlumniAgency(): Promise<void> {
  const src = "imports/abroad-alumni/finalized-abroad-alumni.xlsx";
  const rows = await readSheet(src);
  const rep: Report = { file: "alumni-agency.xlsx", source: src, inRows: rows.length, outRows: 0, dropped: [] };
  const out: (string | number)[][] = [];
  let order = 0;
  for (const row of rows) {
    const country = str(row["ประเทศ"]);
    const thai = str(row["ชื่อไทย"]);
    // Mirror the parser's splitFirstLast: first token = firstName, rest = lastName.
    // (Title lives in the separate คำนำหน้า column, so do NOT strip it here.)
    const parts = thai.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || "";
    const englishName = str(row["ชื่ออังกฤษ"]);
    if (!country) {
      drop(rep, "missing country");
      continue;
    }
    if (!firstName && !lastName && !englishName) {
      drop(rep, "no name (thai/english)");
      continue;
    }
    order++;
    out.push([
      toInt(row["ลำดับ"]) ?? order,
      str(row["รุ่น"]),
      str(row["คำนำหน้า"]),
      firstName,
      lastName,
      englishName,
      str(row["สถานที่ทำงาน"]),
      str(row["ที่อยู่บ้าน"]),
      country,
      str(row["หมายเหตุ"]),
    ]);
  }
  rep.outRows = out.length;
  reports.push(rep);
  await writeSheet(
    "alumni-agency.xlsx",
    ["ลำดับ", "รุ่น", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่ออังกฤษ", "สถานที่ทำงาน", "ที่อยู่บ้าน", "ประเทศ", "หมายเหตุ"],
    out,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Building import excels into ${OUT_DIR}/ ...\n`);

  await buildAwards();
  await buildAssociations();
  await buildGraduateCommittee();
  await buildModelRepresentatives();
  await buildPotentials();
  await buildAlumniAgency();

  console.log("\n──────── SUMMARY ────────");
  for (const r of reports) {
    const dropTxt =
      r.dropped.length > 0
        ? ` (dropped ${r.inRows - r.outRows}: ${r.dropped
            .map((d) => `${d.count}×${d.reason}`)
            .join(", ")})`
        : "";
    console.log(`  ${r.file.padEnd(26)} ${String(r.outRows).padStart(4)} rows  ← ${r.source}${dropTxt}`);
  }

  const alumniPath = path.join(OUT_DIR, "alumni.xlsx");
  if (fs.existsSync(alumniPath)) {
    console.log(`\n  alumni.xlsx — left as-is (canonical full build, ${fs.statSync(alumniPath).size} bytes)`);
  }
  console.log("\nDone. All files are ready for import testing.");
}

main().catch((e) => {
  console.error("Build failed:", e);
  process.exit(1);
});

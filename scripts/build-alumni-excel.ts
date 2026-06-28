/**
 * Build imports/excels/alumni.xlsx from the legacy SQL Server alumni dump.
 *
 * Source: imports/json/alumni_json/Tbl_temp_(main_alumni_data).json — the
 * `Tbl_temp` table (the old AlumniNurse SQL Server DB's main alumni table,
 * exported to JSON). The sibling ref_Edu.json documents the `TypeEdu` code →
 * degree level mapping (we use a built-in copy below so the script is robust).
 *
 * The output columns match EXACTLY what `POST /api/alumni/import`
 * (app/api/alumni/import/route.ts) reads, so the resulting .xlsx is
 * import-ready. Birthday is intentionally NOT included — there is no alumni
 * import column for it (birthday comes from CMU on profile enrichment), and
 * the source `BDay` is mostly a `1900-01-*` sentinel anyway.
 *
 * Source-data corruption handled (the JSON export was lossy):
 *  - **Mojibake digits.** ASCII digits `0–9` (U+0030–39) in `StudID`/`TypeEdu`
 *    were corrupted to `İ/ı/Ĳ/ĳ/Ĵ/ĵ/Ķ/ĸ/Ĺ` (U+0130–0139) in some rows.
 *    `normMojibake()` maps them back to `0–9`, recovering ~360 student IDs and
 *    ~92 degree codes. It is applied to every field; Thai (U+0E00+) and ASCII
 *    letters are untouched, so it is safe on names/addresses.
 *  - **Row-concatenation corruption.** ~63 rows have a `StudID` that is
 *    several records mashed together (`"501251003นางวนิดา…0416010000134…"`),
 *    so their fields are unrecoverably misaligned. These are DROPPED (and
 *    counted) — reconstructing them reliably is impossible.
 *  - **Garbage `TypeEdu`, clean identity.** ~59 rows have a clean numeric
 *    `StudID` + name but a `TypeEdu` that absorbed another record's data.
 *    Kept as alumni with degree = fallback (ปริญญาตรี); CMU sets the real
 *    degree on profile view.
 *
 * Field mapping (legacy → รหัสนักศึกษา/คำนำหน้า/ชื่อ/นามสกุล/รุ่น สาขา/ระดับการศึกษา/อีเมล/เบอร์โทร/ที่อยู่ปัจจุบัน):
 *   StudID      → รหัสนักศึกษา        (required, numeric; non-numeric dropped)
 *   PRENAME     → คำนำหน้า            (required)
 *   TFNAME      → ชื่อ                (required)
 *   TLNAME      → นามสกุล             (required)
 *   TMajorID_Code → (dropped — raw 2-digit major code, no name to decode, and
 *                   CMU fills major/cohort on profile view; cohort is optional)
 *   TypeEdu     → ระดับการศึกษา       (decoded via ref_Edu to the Thai label the
 *                                     import's DEGREE_LEVEL_MAP understands)
 *   email       → อีเมล              (CONTACT email — import writes it to
 *                                    `contactEmail`, NOT the auth `email`)
 *   PHONE ?? mobile ?? phone_work → เบอร์โทร (parsed via parsePhones: keeps only
 *                                    the mobile after "มือถือ", splits commas into
 *                                    a list; emitted comma-joined — the import
 *                                    re-splits into `phones[]`)
 *   col_17/AMPR/PROV/POST → ที่อยู่ปัจจุบัน (joined into one address string)
 *
 * The legacy table can hold one row per degree for the same person (distinct
 * StudID per degree), so we dedupe by StudID keeping the HIGHEST degree.
 *
 * Run with:
 *   node --import tsx scripts/build-alumni-excel.ts
 */
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { parsePhones } from "@/lib/parse-phone";

const ALUMNI_JSON = "imports/json/alumni_json/Tbl_temp_(main_alumni_data).json";
const REF_EDU_JSON = "imports/json/alumni_json/ref_Edu.json";
const OUT_XLSX = "imports/excels/alumni.xlsx";

interface LegacyAlumni {
  StudID: string | null;
  PRENAME: string | null;
  TFNAME: string | null;
  TLNAME: string | null;
  TLNAME_NEW: string | null;
  TypeEdu: string | null;
  TMajorID_Code: string | null;
  BDay: string | null;
  col_17: string | null;
  AMPR: string | null;
  PROV: string | null;
  POST: string | null;
  PHONE: string | null;
  mobile: string | null;
  phone_work: string | null;
  email: string | null;
}

interface RefEdu {
  ide: string;
  Edu_name: string;
}

/** ref_Edu code → Thai degree label that the import's DEGREE_LEVEL_MAP knows. */
const DEGREE_LABEL: Record<string, string> = {
  "01": "ปริญญาตรี",
  "02": "ปริญญาตรี", // ปริญญาตรี(ต่อเนื่อง) → ปริญญาตรี (BACHELOR)
  "03": "ปริญญาโท",
  "04": "ปริญญาเอก",
  "05": "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
  "06": "อนุปริญญา",
};

/** Highest-degree ranking for dedup (higher = kept). */
const DEGREE_RANK: Record<string, number> = {
  "04": 5, // DOCTORAL
  "03": 4, // MASTER
  "01": 3, // BACHELOR
  "02": 3, // BACHELOR (continuous)
  "06": 2, // ASSOCIATE
  "05": 1, // NURSING_ASSISTANT
};

const DEGREE_FALLBACK = "ปริญญาตรี"; // unknown/null TypeEdu → BACHELOR (matches import fallback)

/**
 * Repair the mojibake where ASCII digits 0–9 (U+0030–39) became U+0130–0139
 * (İ ı Ĳ ĳ Ĵ ĵ Ķ ĸ Ĺ). Safe on any string: only chars in [U+0130, U+0139] are
 * rewritten; Thai (U+0E00+) and ASCII letters are untouched.
 */
function normMojibake(s: unknown): string {
  return String(s ?? "").replace(/[İ-Ĺ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x0130 + 0x0030)
  );
}

function clean(v: unknown): string {
  return normMojibake(v).trim();
}

/** Build a readable Thai address from the legacy address fragments. */
function buildAddress(r: LegacyAlumni): string {
  const parts: string[] = [];
  const street = clean(r.col_17);
  if (street && street !== "-") parts.push(street);
  const amphur = clean(r.AMPR);
  if (amphur && amphur !== "-" && amphur !== " -") parts.push(`อ.${amphur}`);
  const prov = clean(r.PROV);
  if (prov && prov !== "-" && prov !== " -") parts.push(`จ.${prov}`);
  const post = clean(r.POST);
  if (post && post !== "-" && post !== " -") parts.push(post);
  return parts.join(" ");
}

function main() {
  if (!fs.existsSync(ALUMNI_JSON)) {
    throw new Error(`Source not found: ${ALUMNI_JSON}`);
  }

  const all = JSON.parse(fs.readFileSync(ALUMNI_JSON, "utf8")) as LegacyAlumni[];
  const refEdu = fs.existsSync(REF_EDU_JSON)
    ? (JSON.parse(fs.readFileSync(REF_EDU_JSON, "utf8")) as RefEdu[])
    : [];
  if (refEdu.length === 0) {
    console.warn(`(warn) ${REF_EDU_JSON} missing/empty — using built-in DEGREE_LABEL map`);
  }

  console.log(`Source rows (Tbl_temp): ${all.length}`);

  // TypeEdu distribution (for the report) — bucket garbage/unmapped codes.
  const typeEduDist = new Map<string, number>();
  for (const r of all) {
    const k = clean(r.TypeEdu);
    const bucket = /^(0[1-6])$/.test(k) ? k : k === "" ? "(empty)" : "(garbage/unmapped)";
    typeEduDist.set(bucket, (typeEduDist.get(bucket) ?? 0) + 1);
  }
  console.log("\nTypeEdu distribution (after mojibake repair):");
  for (const [k, n] of [...typeEduDist.entries()].sort()) {
    console.log(`  ${k.padEnd(20)} ${n}`);
  }

  // Filter: must have a numeric StudID (after mojibake repair).
  let droppedNoStudId = 0;
  let droppedConcatenated = 0;
  let recoveredMojibake = 0;
  const valid: LegacyAlumni[] = [];
  for (const r of all) {
    const raw = String(r.StudID ?? "").trim();
    const id = clean(raw); // repairs İ/ı/Ĳ… → 0–9
    if (!id) {
      droppedNoStudId++;
      continue;
    }
    if (!/^\d+$/.test(id)) {
      droppedConcatenated++; // row-concatenation corruption (unrecoverable)
      continue;
    }
    if (id !== raw) recoveredMojibake++;
    valid.push(r);
  }
  console.log(
    `\nStudID: recovered ${recoveredMojibake} via mojibake repair; dropped ${droppedNoStudId} empty + ${droppedConcatenated} row-concatenation-corrupted → ${valid.length} valid rows`
  );

  // Dedupe by StudID, keeping the highest degree.
  const byId = new Map<string, LegacyAlumni>();
  let dupCount = 0;
  for (const r of valid) {
    const id = clean(r.StudID);
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, r);
    } else {
      dupCount++;
      if ((DEGREE_RANK[clean(r.TypeEdu)] ?? 0) > (DEGREE_RANK[clean(existing.TypeEdu)] ?? 0)) {
        byId.set(id, r);
      }
    }
  }
  console.log(`Duplicate StudID collapsed (kept highest degree): ${dupCount}`);

  // Map → output rows + track required-field completeness.
  const rows: Record<string, string>[] = [];
  let missingRequired = 0;
  let multiPhoneRows = 0;
  const outDegreeDist = new Map<string, number>();
  for (const r of byId.values()) {
    const prefix = clean(r.PRENAME);
    const firstName = clean(r.TFNAME);
    const lastName = clean(r.TLNAME);
    const degreeCode = clean(r.TypeEdu);
    const degreeLabel = degreeCode ? DEGREE_LABEL[degreeCode] ?? DEGREE_FALLBACK : DEGREE_FALLBACK;
    // Phone: keep only the mobile after "มือถือ" and split commas into a list;
    // emit comma-joined for the cell (the import re-splits into phones[]).
    let phones = parsePhones(r.PHONE);
    if (!phones.length) phones = parsePhones(r.mobile);
    if (!phones.length) phones = parsePhones(r.phone_work);
    if (phones.length > 1) multiPhoneRows++;
    const address = buildAddress(r);

    outDegreeDist.set(degreeLabel, (outDegreeDist.get(degreeLabel) ?? 0) + 1);

    if (!prefix || !firstName || !lastName) missingRequired++;

    rows.push({
      รหัสนักศึกษา: clean(r.StudID),
      คำนำหน้า: prefix,
      ชื่อ: firstName,
      นามสกุล: lastName,
      "รุ่น/สาขา": "",
      ระดับการศึกษา: degreeLabel,
      อีเมล: clean(r.email),
      เบอร์โทร: phones.join(", "),
      ที่อยู่ปัจจุบัน: address,
    });
  }

  console.log(`\nOutput rows: ${rows.length}`);
  console.log(`Rows missing a required field (prefix/ชื่อ/นามสกุล): ${missingRequired} (import will skip these)`);
  console.log(`Rows with >1 phone number: ${multiPhoneRows}`);
  console.log("\nระดับการศึกษา distribution (output):");
  for (const [k, n] of [...outDegreeDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(45)} ${n}`);
  }

  // Write the workbook.
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("ศิษย์เก่า");
  const columns = Object.keys(rows[0]);
  ws.columns = columns.map((key) => ({ header: key, key, width: 18 }));
  ws.addRows(rows);

  // Bold header row (polish; the import reads cell values, not styling).
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.alignment = { horizontal: "left", vertical: "middle" };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  fs.mkdirSync(path.dirname(OUT_XLSX), { recursive: true });
  workbook.xlsx.writeBuffer().then((buf) => {
    fs.writeFileSync(OUT_XLSX, Buffer.from(buf));
    console.log(`\n✓ Wrote ${OUT_XLSX} (${rows.length} rows, ${(fs.statSync(OUT_XLSX).size / 1024).toFixed(1)} KB)`);
  });
}

main();

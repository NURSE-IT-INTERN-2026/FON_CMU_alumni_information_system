/**
 * Rebuild awards from the REAL data scraped from the FON CMU alumni site
 * (imports/scrapped/alumni-awards.json), joining each recipient's name →
 * studentId via imports/scrapped/alumni-data.json — same recipe as
 * scripts/rebuild-model-representatives.ts.
 *
 * The scrape has only: รางวัล (awardName), รายชื่อ (recipient name w/ title +
 * maiden parenthetical), รุ่น (cohort code), ปี (Buddhist year). It has NO
 * awardType, link, imageUrl, or description, so:
 *  - awardType is derived from the award name by granting-body rules
 *    (see classifyAwardType). link/imageUrl/description are left null.
 *  - The recipient name is split into prefix / firstName / lastName (PRD shape),
 *    stripping the Thai title prefix and the (maiden) parenthetical.
 *
 * Rows whose recipient name matches no alumni are dropped and written to
 * alumni-awards-unmatched.json. The empty-award-name row is dropped; a stray
 * trailing " ลบ" ("delete") marker on one award name is stripped, not dropped.
 *
 * Run with:
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/rebuild-awards.ts   # preview
 *   node --env-file=.env --import tsx scripts/rebuild-awards.ts             # load
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import { ensureAlumni } from "@/lib/ensure-alumni";
import { AWARD_TYPE_LABELS } from "@/lib/constants";

const AWARDS_JSON = "imports/scrapped/alumni-awards.json";
const ALUMNI_JSON = "imports/scrapped/alumni-data.json";
const OUT_XLSX = "imports/finalized/awards.xlsx";
const UNMATCHED_JSON = "imports/scrapped/alumni-awards-unmatched.json";

type AwardType = "INTERNATIONAL" | "NATIONAL" | "LOCAL";

interface ScrapeAward {
  รางวัล: string;
  รายชื่อ: string;
  รุ่น?: string;
  ปี: number;
}
interface AlumniRow {
  studentId: string;
  firstName: string;
  lastNameOld?: string;
  lastNameNew?: string;
}

// ── Award-type classification ───────────────────────────────────────────────
// INTERNATIONAL = foreign granting body / explicit "International".
// NATIONAL = Thai national-level body (checked before LOCAL so a national award
//   that merely mentions a university — e.g. "อาจารย์ดีเด่นแห่งชาติ ปอมท." from
//   a CMU dean — is NATIONAL, not LOCAL).
// LOCAL = single-institution (มหาวิทยาลัย/คณะ/วิทยาลัย/สมาคมศิษย์เก่า) or
//   regional/provincial/school/Rotary.
// default = NATIONAL (most of these are national nursing-body awards).

const INTL_KEYWORDS = [
  "นานาชาติ", "INTERNATIONAL", "FAAN", "AMERICAN ACADEMY OF NURSING",
  "UAB", "UNIVERSITY OF ALABAMA", "ALABAMA", "UNIVERSITY OF WASHINGTON",
  "HALL OF FAME", "STTI", "SIGMA THETA TAU", "PHI KAPPA PHI", "PHI BETA DELTA",
  "DISTINGUISHED ALUMNI AWARD", "CARTER AWARD", "TARA AWARD", "VISIONARY LEADER",
  "CERTIFICATE OF APPRECIATION FOR INTERNATIONAL LEADERSHIP",
];

const NATIONAL_KEYWORDS = [
  "แห่งชาติ", "แห่งประเทศไทย", "เเห่งประเทศไทย", // incl. scrape's double-mai-ek typo
  "กระทรวง", "สภาการพยาบาล", "ศรีสังวาลย์", "วันมหิดล", // NOT bare "มหิดล" (→ มหาวิทยาลัยมหิดล)
  "เลิศรัฐ", "ก.พ.ร.", "กพร", "ปอมท.", "ปอมท ", "ทคพย.", "ปขมท.",
  "ข้าราชการพลเรือนดีเด่น", "ทุนรัฐบาลไทย", "รัฐบาลไทย", "นายกรัฐมนตรี",
  "สมาคมพยาบาลสาธารณสุขไทย", "สมาคมพยาบาลจิตเวช", "สมาคมนักบริหารโรงพยาบาล",
  "สหพันธ์สมาคมสตรี", "คนดี ศรีสาธารณสุข", "ธัญญารักษ์", "EACC", "R2R",
  "นางสาวไทย", // Miss Thailand
];

const LOCAL_KEYWORDS = [
  "มหาวิทยาลัย", "คณะพยาบาลศาสตร์", "คณะครุศาสตร์", "คณะวิทยาศาสตร์", "คณะแพทยศาสตร์",
  "วิทยาลัย",
  "สมาคมศิษย์เก่า", "สมาคมนักศึกษาเก่า", "สมาคมศิย์เก่า", // incl. typo ศิย์
  "นิสิตเก่า", "ศิษย์เก่าพยาบาล",
  "โรงเรียน", "โรตารี", "สโมสรโรตารี",
  "ภาคเหนือ", "ภาคใต้", "ภาคกลาง", "ภาคอีสาน", "ส่วนภูมิภาค", "จังหวัด",
];
// bare "คณะ" would also match "คณะกรรมการ" (committee) — use faculty names above.

function classifyAwardType(rawName: string): AwardType {
  const n = rawName.toUpperCase();
  if (INTL_KEYWORDS.some((k) => n.includes(k.toUpperCase()))) return "INTERNATIONAL";
  if (NATIONAL_KEYWORDS.some((k) => n.includes(k))) return "NATIONAL";
  if (LOCAL_KEYWORDS.some((k) => n.includes(k))) return "LOCAL";
  return "NATIONAL";
}

// ── Title-prefix stripping (extended from rebuild-model-representatives) ─────
// Multi-token / longer prefixes first; the loop keeps stripping until stable so
// compounds like "ศาสตราจารย์ ดร." unwind fully. Returns the captured prefix
// (null when there was none) and the remainder.
const TITLE_PREFIXES = [
  "ศาสตราจารย์ ดร.", "ศ.ดร.", "ศ. ดร.",
  "รศ.ดร.", "รศ ดร.", "ผศ.ดร.", "ผศ ดร.", "อ.ดร.", "อ ดร.",
  "ศาสตราจารย์", "ศ.",
  "รศ.", "รศ ", "ผศ.", "ผศ ", "อาจารย์", "อจ.", "อ.", "ดร.",
  "มล.", "มล ",
  "คุณหญิง", "คุณหม่อม", "คุณ",
  "นายแพทย์", "นพ.", "แพทย์หญิง", "พญ.",
  "นาย", "นางสาว", "นาง",
  "Prof.", "Assoc.Prof.", "Asst.Prof.", "Dr.",
];

function stripTitlePrefix(raw: string): { prefix: string | null; rest: string } {
  let s = raw.trim();
  let prefix = "";
  for (;;) {
    const before = s;
    for (const p of TITLE_PREFIXES) {
      if (s.startsWith(p)) {
        prefix += (prefix ? " " : "") + p.trim();
        s = s.slice(p.length).trim();
        break;
      }
    }
    if (s === before) break;
  }
  return { prefix: prefix || null, rest: s };
}

// ── Name parsing: split "นางสาวเจียรนัย นุชเกษม(โพธิ์ไทรย์)" ───────────────
// → prefix "นางสาว", firstName "เจียรนัย", lastName "นุชเกษม", maiden "โพธิ์ไทรย์"
interface ParsedName {
  prefix: string | null;
  firstName: string;
  lastName: string;
  maiden: string | null;
}

function parseRecipientName(raw: string): ParsedName {
  let name = raw.replace(/\s+/g, " ").trim();

  // Extract a Thai maiden name from a trailing "(…)" (English titles like
  // (Dean)/(President) are not names). Adapted from seed.ts:parseThaiName.
  let maiden: string | null = null;
  const parenMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*(.*)$/);
  if (parenMatch) {
    const paren = parenMatch[2].trim();
    const isThai = /[ก-๛]/.test(paren);
    const isEngTitle = /^(Dean|President|Director|Former|Prof|Dr|Mr|Mrs|Ms)/i.test(paren);
    if (isThai && !isEngTitle) {
      maiden = paren;
      name = `${parenMatch[1]} ${parenMatch[3]}`.replace(/\s+/g, " ").trim();
    }
  }
  // Drop any remaining non-name bracketed annotations.
  name = name.replace(/\s*[\[(].*?[\])]/g, "").trim();

  const { prefix, rest } = stripTitlePrefix(name);
  const parts = rest.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { prefix, firstName, lastName, maiden };
}

// ── Alumni name → studentId index (tries current + maiden surname) ──────────
function buildAlumniIndex(rows: AlumniRow[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const a of rows) {
    const first = (a.firstName ?? "").trim();
    if (!first) continue;
    for (const ln of [a.lastNameNew, a.lastNameOld]) {
      const last = (ln ?? "").trim();
      if (!last || last === "-") continue;
      const key = `${first} ${last}`.replace(/\s+/g, " ");
      if (!idx.has(key)) idx.set(key, a.studentId);
    }
  }
  return idx;
}

interface MatchedAward {
  studentId: string;
  prefix: string | null;
  firstName: string;
  lastName: string;
  awardName: string;
  awardType: AwardType;
  year: number;
  rawName: string; // original recipient name (for display + ensureAlumni)
}

async function main() {
  const awards = JSON.parse(fs.readFileSync(AWARDS_JSON, "utf-8")) as ScrapeAward[];
  const alumni = JSON.parse(fs.readFileSync(ALUMNI_JSON, "utf-8")) as AlumniRow[];
  console.log(`Loaded ${awards.length} scraped awards, ${alumni.length} alumni records`);

  const idx = buildAlumniIndex(alumni);

  const matched: MatchedAward[] = [];
  const unmatched: ScrapeAward[] = [];
  let droppedEmptyName = 0;
  const typeCache = new Map<string, AwardType>();

  for (const a of awards) {
    let awardName = (a["รางวัล"] ?? "").replace(/\s+/g, " ").trim();
    if (!awardName) {
      droppedEmptyName++;
      continue;
    }
    if (awardName.endsWith("ลบ")) awardName = awardName.replace(/\s*ลบ\s*$/, "").trim();

    // classify by distinct name (cache)
    let awardType = typeCache.get(awardName);
    if (!awardType) {
      awardType = classifyAwardType(awardName);
      typeCache.set(awardName, awardType);
    }

    const rawName = (a["รายชื่อ"] ?? "").trim();
    const parsed = parseRecipientName(rawName);

    // Match on current name first, then maiden.
    let studentId: string | undefined;
    if (parsed.firstName && parsed.lastName) {
      studentId = idx.get(`${parsed.firstName} ${parsed.lastName}`);
    }
    if (!studentId && parsed.firstName && parsed.maiden) {
      studentId = idx.get(`${parsed.firstName} ${parsed.maiden}`);
    }

    if (!studentId) {
      unmatched.push(a);
      continue;
    }

    matched.push({
      studentId,
      prefix: parsed.prefix,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      awardName,
      awardType,
      year: Number(a["ปี"]),
      rawName,
    });
  }

  console.log(
    `\nDropped ${droppedEmptyName} row(s) with empty award name.\n` +
      `Matched ${matched.length}/${awards.length}; unmatched ${unmatched.length}`,
  );

  // Per-type distribution (by matched row).
  const dist: Record<AwardType, number> = { INTERNATIONAL: 0, NATIONAL: 0, LOCAL: 0 };
  for (const m of matched) dist[m.awardType]++;
  console.log("Matched type distribution:", JSON.stringify(dist));

  // Show the smaller / error-prone buckets in full for review.
  for (const t of ["INTERNATIONAL", "LOCAL"] as AwardType[]) {
    const names = [...new Set(matched.filter((m) => m.awardType === t).map((m) => m.awardName))];
    console.log(`\n=== ${t} (${names.length} distinct) ===`);
    for (const n of names) console.log(`  • ${n}`);
  }

  // Sanity check: flag any NATIONAL award whose name still contains an
  // institution keyword (potential LOCAL misclassification).
  const strayInstitutional = [
    ...new Set(
      matched
        .filter((m) => m.awardType === "NATIONAL")
        .map((m) => m.awardName)
        .filter((n) =>
          ["มหาวิทยาลัย", "คณะพยาบาลศาสตร์", "วิทยาลัย", " มช.", "จุฬา", "สงขลานครินทร์", "ศรีนครินทรวิโรฒ", "รามาธิบดี", "โรตารี", "ภาคเหนือ"]
            .some((k) => n.includes(k)),
        ),
    ),
  ];
  if (strayInstitutional.length) {
    console.log("\n=== ⚠ NATIONAL names that look institution/regional (verify) ===");
    for (const n of strayInstitutional) console.log(`  • ${n}`);
  } else {
    console.log("\n(no NATIONAL names carry institution/regional keywords ✓)");
  }

  // ── write the import artifact (matches what the DB will hold) ──
  fs.mkdirSync(path.dirname(OUT_XLSX), { recursive: true });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow([
    "รหัสนักศึกษา", "คำนำหน้า", "ชื่อ", "นามสกุล", "สาขาวิชา",
    "ชื่อรางวัล", "ประเภทรางวัล", "ปี (พ.ศ.)", "ลิงค์", "รูปภาพ", "รายละเอียด",
  ]);
  for (const m of matched) {
    ws.addRow([
      m.studentId, m.prefix ?? "", m.firstName, m.lastName, "",
      m.awardName, AWARD_TYPE_LABELS[m.awardType], m.year, "", "", "",
    ]);
  }
  await wb.xlsx.writeFile(OUT_XLSX);
  console.log(`\nWrote ${OUT_XLSX} (${matched.length} rows)`);

  fs.writeFileSync(UNMATCHED_JSON, JSON.stringify(unmatched, null, 2), "utf-8");
  console.log(`Wrote ${UNMATCHED_JSON} (${unmatched.length} unmatched)`);
  if (unmatched.length) {
    console.log(
      "  e.g.:",
      unmatched.slice(0, 5).map((u) => `${u["ปี"]} ${u["รายชื่อ"]} — ${u["รางวัล"]?.slice(0, 40)}`).join(" | "),
    );
  }

  if (process.env.DRY_RUN === "1") {
    console.log("\nDRY RUN — database untouched. Re-run without DRY_RUN to load.");
    return;
  }

  // ── clear + reload ──
  const before = await prisma.award.count();
  console.log(`\nExisting awards rows: ${before} (clearing…)`);
  await prisma.award.deleteMany({});

  let imported = 0;
  for (const m of matched) {
    const alumniRec = await ensureAlumni(m.studentId, m.rawName); // backfills major/degree
    await prisma.award.create({
      data: {
        studentId: alumniRec.studentId,
        prefix: m.prefix,
        firstName: m.firstName,
        lastName: m.lastName,
        awardName: m.awardName,
        awardType: m.awardType,
        year: m.year,
        major: alumniRec.major ?? null,
        link: null,
        imageUrl: null,
        description: null,
      },
    });
    imported++;
  }

  const after = await prisma.award.count();
  console.log(`Imported ${imported} awards. awards now holds ${after} rows.`);
  console.log("(major sync depends on CMU Registrar API reachability)");
}

main()
  .catch((e) => {
    console.error("Rebuild failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

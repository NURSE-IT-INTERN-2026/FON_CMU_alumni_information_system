/**
 * Rebuild model-representatives from the REAL alumni-network data scraped from
 * https://mis.nurse.cmu.ac.th/alumninurse/alumniNetwork.aspx
 * (imports/scrapped/alumni-network.json), joining each rep's name → studentId
 * via imports/scrapped/alumni-data.json.
 *
 * Why: the import Excel previously held 15 fabricated test rows (all
 * เครือข่าย = ปริญญาโท) generated from CMU degree level (build-test-imports.ts
 * cohortLabel). The เครือข่าย value must instead come from the alumniNetwork
 * section title with "รายชื่อเครือข่ายศิษย์เก่า" and the "(รุ่น …)" range removed.
 * alumni-network.json already stores these stripped values; normalizeNetwork()
 * re-applies the recipe as a guard and to document intent.
 *
 * Only reps whose name matches an alumni record are imported; the rest are
 * written to alumni-network-unmatched.json for manual mapping.
 *
 * Run with:
 *   node --env-file=.env --import tsx scripts/rebuild-model-representatives.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import { ensureAlumni } from "@/lib/ensure-alumni";
import { splitFullName } from "@/lib/parse-name";

const NETWORK_JSON = "imports/scrapped/alumni-network.json";
const ALUMNI_JSON = "imports/scrapped/alumni-data.json";
const OUT_XLSX = "imports/finalized/model-representatives.xlsx";
const UNMATCHED_JSON = "imports/scrapped/alumni-network-unmatched.json";

interface NetworkRep {
  เครือข่าย: string;
  รุ่นที่: number;
  ชื่อ: string;
}
interface AlumniRow {
  studentId: string;
  firstName: string;
  lastNameOld?: string;
  lastNameNew?: string;
}

/**
 * The user's header-stripping recipe, applied defensively:
 * drop the literal "รายชื่อเครือข่ายศิษย์เก่า" and any "(รุ่น …)" cohort range.
 * No-op on the already-stripped values in alumni-network.json.
 */
function normalizeNetwork(raw: string): string {
  return raw
    .replace(/รายชื่อเครือข่ายศิษย์เก่า/g, "")
    .replace(/\(?\s*รุ่น\s*\d+\s*[–-]\s*\d+\s*\)?/g, "") // "(รุ่น 1 – 38)"
    .replace(/\(?\s*รุ่น\s*\d+\s*\)?/g, "") // "(รุ่น 6)"
    .replace(/\s+/g, " ")
    .trim();
}

// Leading title prefixes used on the alumniNetwork page. Order matters:
// multi-token forms (รศ.ดร.) must come before their single-token prefixes (รศ.).
// The loop below keeps stripping so compound prefixes like "รศ.มล." unwind fully.
const TITLE_PREFIXES = [
  "รศ.ดร.",
  "รศ ดร.",
  "ผศ.ดร.",
  "ผศ ดร.",
  "อ.ดร.",
  "อ ดร.",
  "รศ.",
  "รศ ",
  "ผศ.",
  "ผศ ",
  "อจ.",
  "อ.",
  "ดร.",
  "มล.",
  "มล ",
  "คุณหญิง",
  "คุณหม่อม",
  "คุณ",
  "นาย",
  "นางสาว",
  "นาง",
];

function stripTitlePrefix(name: string): string {
  let s = name.trim();
  for (;;) {
    const before = s;
    for (const p of TITLE_PREFIXES) {
      if (s.startsWith(p)) {
        s = s.slice(p.length).trim();
        break;
      }
    }
    if (s === before) break; // no leading prefix left
  }
  return s;
}

/** Index alumni records by "firstName lastName" → studentId (first match wins). */
function buildAlumniIndex(rows: AlumniRow[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const a of rows) {
    const first = (a.firstName ?? "").trim();
    if (!first) continue;
    for (const ln of [a.lastNameOld, a.lastNameNew]) {
      const last = (ln ?? "").trim();
      if (!last || last === "-") continue;
      const key = `${first} ${last}`.replace(/\s+/g, " ");
      if (!idx.has(key)) idx.set(key, a.studentId);
    }
  }
  return idx;
}

async function main() {
  const reps = JSON.parse(fs.readFileSync(NETWORK_JSON, "utf-8")) as NetworkRep[];
  const alumni = JSON.parse(fs.readFileSync(ALUMNI_JSON, "utf-8")) as AlumniRow[];
  console.log(
    `Loaded ${reps.length} network reps, ${alumni.length} alumni records`,
  );

  const idx = buildAlumniIndex(alumni);

  type Matched = {
    studentId: string;
    name: string;
    cohort: string;
    generation: number;
  };
  const matched: Matched[] = [];
  const unmatched: NetworkRep[] = [];

  for (const r of reps) {
    const cohort = normalizeNetwork(r["เครือข่าย"]);
    const cleanName = stripTitlePrefix(r["ชื่อ"]);
    const studentId = idx.get(cleanName);
    if (studentId) {
      matched.push({
        studentId,
        name: r["ชื่อ"].trim(),
        cohort,
        generation: Number(r["รุ่นที่"]),
      });
    } else {
      unmatched.push(r);
    }
  }

  console.log(
    `Matched ${matched.length}/${reps.length}; unmatched ${unmatched.length}`,
  );

  const dist: Record<string, number> = {};
  for (const m of matched) dist[m.cohort] = (dist[m.cohort] ?? 0) + 1;
  console.log("Matched เครือข่าย distribution:", JSON.stringify(dist));

  // --- write the import artifact (matches what the DB will hold) ---
  fs.mkdirSync(path.dirname(OUT_XLSX), { recursive: true });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(["รหัสนักศึกษา", "ชื่อ-นามสกุล", "เครือข่าย", "ลำดับรุ่น"]);
  for (const m of matched) {
    ws.addRow([m.studentId, m.name, m.cohort, m.generation]);
  }
  await wb.xlsx.writeFile(OUT_XLSX);
  console.log(`Wrote ${OUT_XLSX} (${matched.length} rows)`);

  // --- report unmatched reps for manual studentId mapping ---
  fs.writeFileSync(UNMATCHED_JSON, JSON.stringify(unmatched, null, 2), "utf-8");
  console.log(`Wrote ${UNMATCHED_JSON} (${unmatched.length} unmatched)`);
  if (unmatched.length) {
    console.log(
      "  e.g.:",
      unmatched
        .slice(0, 5)
        .map((u) => `${u["เครือข่าย"]} รุ่น${u["รุ่นที่"]} ${u["ชื่อ"]}`)
        .join(" | "),
    );
  }

  // DRY_RUN=1 → stop here (no DB writes). Preview counts + artifacts only.
  if (process.env.DRY_RUN === "1") {
    console.log("\nDRY RUN — database untouched. Re-run without DRY_RUN to load.");
    return;
  }

  // --- clear fabricated rows, then load the real reps ---
  const before = await prisma.modelRepresentative.count();
  console.log(`\nExisting model_representatives rows: ${before} (clearing…)`);
  await prisma.modelRepresentative.deleteMany({});

  let imported = 0;
  for (const m of matched) {
    const a = await ensureAlumni(m.studentId, m.name); // backfills major/degree from CMU
    const { prefix, firstName, lastName } = splitFullName(m.name);
    await prisma.modelRepresentative.create({
      data: {
        studentId: a.studentId,
        prefix,
        firstName,
        lastName,
        cohort: m.cohort,
        generation: m.generation,
        major: a.major ?? null,
      },
    });
    imported++;
  }

  const after = await prisma.modelRepresentative.count();
  console.log(
    `Imported ${imported} reps. model_representatives now holds ${after} rows.`,
  );
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

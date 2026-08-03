/**
 * Shared model-representatives Excel I/O contract — keeps the export columns and
 * the import row-parser in one place so they can't drift, and so the export↔table
 * alignment is unit-testable without a database. Client-safe (pure;
 * `splitFullName` is documented pure/client-safe).
 *
 * NOTE the inverted mapping vs sibling entities (per CLAUDE.md): for
 * ModelRepresentative, เครือข่าย→`cohort` and รุ่นที่→`generation` (the OPPOSITE
 * of entities like graduate-committee where `cohort` = รุ่นที่).
 */
import { splitFullName } from "@/lib/parse-name";

/** A model-representative row's export-relevant fields (loose, client-safe + testable). */
export interface ModelRepExportShape {
  studentId: string | null;
  pendingStudentId: string | null;
  prefix: string | null;
  firstName: string | null;
  lastName: string | null;
  cohort: string; // เครือข่าย
  generation: number; // รุ่นที่
  major: string | null;
}

/**
 * Ordered model-representative export columns — mirrors the model-representatives
 * management table's DATA columns (`ลำดับ` row-number and `จัดการ` actions
 * excluded). `buildExcelResponse` derives column order from `Object.keys(rows[0])`,
 * so the key order of `modelRepToExportRow` IS the exported column order.
 */
export const MODELREP_EXPORT_COLUMNS = [
  "เครือข่าย",
  "รุ่นที่",
  "รหัสนักศึกษา",
  "สาขาวิชา",
  "คำนำหน้า",
  "ชื่อ",
  "นามสกุล",
] as const;

/**
 * Map a model-representative row to an export row keyed by the headers above (in
 * order). Preserves the inversion: `เครือข่าย` ← `cohort`, `รุ่นที่` ← `generation`.
 */
export function modelRepToExportRow(
  m: ModelRepExportShape,
): Record<string, string | number> {
  return {
    "เครือข่าย": m.cohort,
    "รุ่นที่": m.generation,
    "รหัสนักศึกษา": m.studentId || m.pendingStudentId || "",
    "สาขาวิชา": m.major || "",
    "คำนำหน้า": m.prefix ?? "",
    "ชื่อ": m.firstName ?? "",
    "นามสกุล": m.lastName ?? "",
  };
}

/** A parsed model-representative import row (before alumni-link resolution). */
export interface ModelRepImportRecord {
  attemptedStudentId: string; // raw id from the row (for the warning + link call)
  prefix: string;
  firstName: string;
  lastName: string;
  cohort: string; // เครือข่าย
  generation: number; // รุ่นที่
}

export type ModelRepImportRowError = { row: number; message: string };
export type ModelRepImportRowResult = {
  data: ModelRepImportRecord | null;
  error: ModelRepImportRowError | null;
};

/** Read คำนำหน้า/ชื่อ/นามสกุล; fall back to a legacy combined ชื่อ-สกุล column. */
function readName(row: Record<string, string>): {
  prefix: string;
  firstName: string;
  lastName: string;
} {
  const prefixCol = row["คำนำหน้า"]?.toString().trim() || "";
  const firstNameCol = row["ชื่อ"]?.toString().trim() || "";
  const lastNameCol = row["นามสกุล"]?.toString().trim() || "";
  const legacyFull = row["ชื่อ-สกุล"]?.toString().trim() || "";
  if (!firstNameCol && !lastNameCol && legacyFull) {
    const parsed = splitFullName(legacyFull);
    return { prefix: parsed.prefix || "", firstName: parsed.firstName, lastName: parsed.lastName };
  }
  return { prefix: prefixCol, firstName: firstNameCol, lastName: lastNameCol };
}

/**
 * Parse + validate one model-representative import row. `เครือข่าย`→`cohort`;
 * `generation` accepts both the page/export header `รุ่นที่` and the legacy
 * `ลำดับรุ่น` so an export→edit→re-import round-trips and old exports still parse.
 * `สาขาวิชา` (major) is intentionally NOT read here — it is alumni-derived at
 * the route layer (the 6-entity design), so the export column is informational only.
 */
export function parseModelRepRow(
  row: Record<string, string>,
  rowNumber: number,
): ModelRepImportRowResult {
  const attemptedStudentId = row["รหัสนักศึกษา"]?.toString().trim() || "";
  const name = readName(row);
  const cohort = row["เครือข่าย"]?.toString().trim() || "";
  const generationStr =
    row["รุ่นที่"]?.toString().trim() || row["ลำดับรุ่น"]?.toString().trim() || "";

  if (!attemptedStudentId || !name.firstName || !name.lastName || !cohort || !generationStr) {
    return { data: null, error: { row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" } };
  }

  const generation = parseInt(generationStr, 10);
  if (isNaN(generation)) {
    return { data: null, error: { row: rowNumber, message: "รุ่นที่ไม่ถูกต้อง" } };
  }

  return {
    data: {
      attemptedStudentId,
      prefix: name.prefix,
      firstName: name.firstName,
      lastName: name.lastName,
      cohort,
      generation,
    },
    error: null,
  };
}

/**
 * Shared graduate-committee Excel I/O contract — keeps the export columns and
 * the import row-parser in one place so they can't drift, and so the export↔table
 * alignment is unit-testable without a database. Client-safe (pure;
 * `splitFullName` is documented pure/client-safe).
 */
import { splitFullName } from "@/lib/parse-name";

/** A graduate-committee row's export-relevant fields (loose, client-safe + testable). */
export interface CommitteeExportShape {
  studentId: string | null;
  pendingStudentId: string | null;
  prefix: string | null;
  firstName: string | null;
  lastName: string | null;
  cohort: string;
  termYear: number;
  position: string;
  major: string | null;
  remarks: string | null;
}

/**
 * Ordered graduate-committee export columns — mirrors the graduate-committee
 * management table's DATA columns (`ลำดับ` row-number and `จัดการ` actions
 * excluded). `buildExcelResponse` derives column order from `Object.keys(rows[0])`,
 * so the key order of `committeeToExportRow` IS the exported column order.
 */
export const COMMITTEE_EXPORT_COLUMNS = [
  "รหัสนักศึกษา",
  "คำนำหน้า",
  "ชื่อ",
  "นามสกุล",
  "รุ่นที่",
  "ปี พ.ศ.",
  "ตำแหน่ง",
  "สาขาวิชา",
  "หมายเหตุ",
] as const;

/** Map a graduate-committee row to an export row keyed by the headers above (in order). */
export function committeeToExportRow(
  c: CommitteeExportShape,
): Record<string, string | number> {
  return {
    "รหัสนักศึกษา": c.studentId || c.pendingStudentId || "",
    "คำนำหน้า": c.prefix ?? "",
    "ชื่อ": c.firstName ?? "",
    "นามสกุล": c.lastName ?? "",
    "รุ่นที่": c.cohort,
    "ปี พ.ศ.": c.termYear,
    "ตำแหน่ง": c.position,
    "สาขาวิชา": c.major || "",
    "หมายเหตุ": c.remarks || "",
  };
}

/** A parsed graduate-committee import row (before alumni-link resolution). */
export interface CommitteeImportRecord {
  attemptedStudentId: string; // raw id from the row (for the warning + link call)
  prefix: string;
  firstName: string;
  lastName: string;
  termYear: number;
  cohort: string;
  position: string;
  remarks: string | null;
}

export type CommitteeImportRowError = { row: number; message: string };
export type CommitteeImportRowResult = {
  data: CommitteeImportRecord | null;
  error: CommitteeImportRowError | null;
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
 * Parse + validate one graduate-committee import row. Reads `ปี พ.ศ.`,
 * `รหัสนักศึกษา`, name, `รุ่นที่`, `ตำแหน่ง`, `หมายเหตุ`. `สาขาวิชา` (major) is
 * intentionally NOT read here — it is alumni-derived at the route layer (the
 * 6-entity design), so the export column is informational only.
 */
export function parseCommitteeRow(
  row: Record<string, string>,
  rowNumber: number,
): CommitteeImportRowResult {
  const termYearStr = row["ปี พ.ศ."]?.toString().trim() || "";
  const attemptedStudentId = row["รหัสนักศึกษา"]?.toString().trim() || "";
  const name = readName(row);
  const cohort = row["รุ่นที่"]?.toString().trim() || "";
  const position = row["ตำแหน่ง"]?.toString().trim() || "";
  const remarks = row["หมายเหตุ"]?.toString().trim() || null;

  if (!termYearStr || !attemptedStudentId || !name.firstName || !name.lastName || !cohort || !position) {
    return { data: null, error: { row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" } };
  }

  const termYear = parseInt(termYearStr, 10);
  if (isNaN(termYear)) {
    return { data: null, error: { row: rowNumber, message: "ปี พ.ศ. ไม่ถูกต้อง" } };
  }

  return {
    data: {
      attemptedStudentId,
      prefix: name.prefix,
      firstName: name.firstName,
      lastName: name.lastName,
      termYear,
      cohort,
      position,
      remarks,
    },
    error: null,
  };
}

/**
 * Shared associations Excel I/O contract — keeps the export columns and the
 * import row-parser in one place so they can't drift, and so the export↔table
 * alignment is unit-testable without a database. Client-safe (pure;
 * `splitFullName` is documented pure/client-safe).
 */
import { splitFullName } from "@/lib/parse-name";

/** An association row's export-relevant fields (loose, client-safe + testable). */
export interface AssociationExportShape {
  studentId: string | null;
  pendingStudentId: string | null;
  prefix: string | null;
  firstName: string | null;
  lastName: string | null;
  associationName: string;
  position: string;
  major: string | null;
  recordedYear: number;
}

/**
 * Ordered association export columns — mirrors the associations management
 * table's DATA columns (`ลำดับ` row-number and `จัดการ` actions excluded).
 * `buildExcelResponse` derives column order from `Object.keys(rows[0])`, so the
 * key order of `associationToExportRow` IS the exported column order.
 */
export const ASSOCIATION_EXPORT_COLUMNS = [
  "รหัสนักศึกษา",
  "คำนำหน้า",
  "ชื่อ",
  "นามสกุล",
  "ชื่อสมาคม/ชมรม",
  "ตำแหน่ง",
  "สาขาวิชา",
  "ปีที่บันทึก",
] as const;

/** Map an association row to an export row keyed by the headers above (in order). */
export function associationToExportRow(
  a: AssociationExportShape,
): Record<string, string | number> {
  return {
    "รหัสนักศึกษา": a.studentId || a.pendingStudentId || "",
    "คำนำหน้า": a.prefix ?? "",
    "ชื่อ": a.firstName ?? "",
    "นามสกุล": a.lastName ?? "",
    "ชื่อสมาคม/ชมรม": a.associationName,
    "ตำแหน่ง": a.position,
    "สาขาวิชา": a.major || "",
    "ปีที่บันทึก": a.recordedYear,
  };
}

/** A parsed association import row (before alumni-link resolution). */
export interface AssociationImportRecord {
  attemptedStudentId: string; // raw id from the row (for the warning + link call)
  prefix: string;
  firstName: string;
  lastName: string;
  associationName: string;
  position: string;
  recordedYear: number;
}

export type AssociationImportRowError = { row: number; message: string };
export type AssociationImportRowResult = {
  data: AssociationImportRecord | null;
  error: AssociationImportRowError | null;
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
 * Parse + validate one association import row. `recordedYear` accepts both the
 * page/export header `ปีที่บันทึก` and the legacy `ปีที่บันทึก (พ.ศ.)` so an
 * export→edit→re-import round-trips and old exports still parse. `สาขาวิชา`
 * (major) is intentionally NOT read here — it is alumni-derived at the route
 * layer (the 6-entity design), so the export column is informational only.
 */
export function parseAssociationRow(
  row: Record<string, string>,
  rowNumber: number,
): AssociationImportRowResult {
  const attemptedStudentId = row["รหัสนักศึกษา"]?.toString().trim() || "";
  const name = readName(row);
  const associationName = row["ชื่อสมาคม/ชมรม"]?.toString().trim() || "";
  const position = row["ตำแหน่ง"]?.toString().trim() || "";
  const recordedYearStr =
    row["ปีที่บันทึก"]?.toString().trim() || row["ปีที่บันทึก (พ.ศ.)"]?.toString().trim() || "";

  if (!attemptedStudentId || !name.firstName || !name.lastName || !associationName || !position || !recordedYearStr) {
    return { data: null, error: { row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" } };
  }

  const recordedYear = parseInt(recordedYearStr, 10);
  if (isNaN(recordedYear)) {
    return { data: null, error: { row: rowNumber, message: "ปีที่บันทึกไม่ถูกต้อง" } };
  }

  return {
    data: {
      attemptedStudentId,
      prefix: name.prefix,
      firstName: name.firstName,
      lastName: name.lastName,
      associationName,
      position,
      recordedYear,
    },
    error: null,
  };
}

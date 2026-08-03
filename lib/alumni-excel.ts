/**
 * Shared all-alumni Excel I/O contract — keeps the alumni export columns and the
 * import row-parser/update-payload in one place so they can't drift, and so the
 * export↔table alignment + the don't-blank update behavior are unit-testable
 * without a database. Client-safe (type-only `DegreeLevel` import; runtime deps
 * `DEGREE_LEVEL_OPTIONS`, `formatBirthDateThai`, `joinPhones`/`parsePhones` are
 * all client-safe — the all-alumni page imports them directly).
 */
import { DEGREE_LEVEL_OPTIONS } from "@/lib/constants";
import { formatBirthDateThai } from "@/lib/alumni-verify";
import { joinPhones, parsePhones } from "@/lib/parse-phone";
import type { DegreeLevel } from "@/app/generated/prisma/client";

/** Thai display labels for degree-level enum values (mirrors the page). */
const DEGREE_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  DEGREE_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
);

/** Thai label → enum (the export emits labels; the import maps them back). */
export const DEGREE_LEVEL_MAP: Record<string, DegreeLevel> = {
  "ปริญญาเอก": "DOCTORAL",
  "ปริญญาโท": "MASTER",
  "ปริญญาตรี": "BACHELOR",
  "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล": "NURSING_ASSISTANT",
  "อนุปริญญา": "ASSOCIATE",
  DOCTORAL: "DOCTORAL",
  MASTER: "MASTER",
  BACHELOR: "BACHELOR",
  NURSING_ASSISTANT: "NURSING_ASSISTANT",
  ASSOCIATE: "ASSOCIATE",
};

/** A merged-alumni row's export-relevant fields (loose, client-safe + testable). */
export interface AlumniExportShape {
  studentId: string;
  cohort: string | null;
  prefix: string;
  firstName: string;
  lastName: string;
  degreeLevel: string | null;
  major: string | null;
  graduationYear: number | null;
  birthDate: string | null;
  email: string | null;
  contactEmail: string | null;
  phones: string[];
  homeAddress: string | null;
  remarks: string | null;
}

/**
 * Ordered alumni export columns — mirrors the all-alumni management table's DATA
 * columns (`ลำดับ` row-number and `จัดการ` actions excluded). `buildExcelResponse`
 * derives column order from `Object.keys(rows[0])`, so the key order of
 * `alumniToExportRow` IS the exported column order.
 */
export const ALUMNI_EXPORT_COLUMNS = [
  "รหัสนักศึกษา",
  "รุ่น",
  "คำนำหน้า",
  "ชื่อ",
  "นามสกุล",
  "ระดับการศึกษา",
  "สาขาวิชา",
  "ปีสำเร็จการศึกษา",
  "วันเกิด",
  "อีเมลติดต่อ",
  "เบอร์โทร",
  "ที่อยู่ปัจจุบัน",
  "หมายเหตุ",
] as const;

/** Map a merged-alumni row to an export row keyed by the headers above (in order). */
export function alumniToExportRow(
  a: AlumniExportShape,
): Record<string, string | number> {
  return {
    "รหัสนักศึกษา": a.studentId,
    "รุ่น": a.cohort || "",
    "คำนำหน้า": a.prefix,
    "ชื่อ": a.firstName,
    "นามสกุล": a.lastName,
    "ระดับการศึกษา": a.degreeLevel ? DEGREE_LEVEL_LABELS[a.degreeLevel] ?? a.degreeLevel : "",
    "สาขาวิชา": a.major || "",
    "ปีสำเร็จการศึกษา": a.graduationYear ?? "",
    "วันเกิด": formatBirthDateThai(a.birthDate) ?? "",
    "อีเมลติดต่อ": a.contactEmail || a.email || "",
    "เบอร์โทร": joinPhones(a.phones),
    "ที่อยู่ปัจจุบัน": a.homeAddress || "",
    "หมายเหตุ": a.remarks || "",
  };
}

/** A parsed alumni import row. The last four fields are EXPORT-only columns. */
export interface AlumniImportRecord {
  studentId: string;
  prefix: string;
  firstName: string;
  lastName: string;
  cohort: string | null;
  degreeLevel: DegreeLevel;
  major: string | null;
  graduationYear: number | null;
  birthDate: string | null;
  remarks: string | null;
  contactEmail: string | null;
  phones: string[];
  homeAddress: string | null;
}

export type AlumniImportRowError = { row: number; message: string };
export type AlumniImportRowResult = {
  data: AlumniImportRecord | null;
  error: AlumniImportRowError | null;
};

/**
 * Parse + validate one alumni import row. Reads the export header names with
 * legacy fallbacks (`รุ่น`→`รุ่น/สาขา`, `อีเมลติดต่อ`→`อีเมล`). `วันเกิด` is kept
 * only as the 8-digit DDMMYYYY-Buddhist form (stripping the export's
 * `DD-MM-YYYY` dashes), so the round-trip is exact. Export-only fields are left
 * null when the row omits them (see `alumniUpdatePayload`).
 */
export function parseAlumniImportRow(
  row: Record<string, string>,
  rowNumber: number,
): AlumniImportRowResult {
  const studentId = row["รหัสนักศึกษา"]?.toString().trim();
  const prefix = row["คำนำหน้า"]?.toString().trim();
  const firstName = row["ชื่อ"]?.toString().trim();
  const lastName = row["นามสกุล"]?.toString().trim();
  const cohort = row["รุ่น"]?.toString().trim() || row["รุ่น/สาขา"]?.toString().trim() || null;
  const degreeLevelRaw = row["ระดับการศึกษา"]?.toString().trim();
  const degreeLevel: DegreeLevel = degreeLevelRaw ? DEGREE_LEVEL_MAP[degreeLevelRaw] || "BACHELOR" : "BACHELOR";
  const major = row["สาขาวิชา"]?.toString().trim() || null;
  const graduationRaw = row["ปีสำเร็จการศึกษา"]?.toString().replace(/\D/g, "") ?? "";
  const graduationYear = graduationRaw ? parseInt(graduationRaw, 10) : null;
  const birthDigits = row["วันเกิด"]?.toString().replace(/\D/g, "") ?? "";
  const birthDate = birthDigits.length === 8 ? birthDigits : null;
  const contactEmail = row["อีเมลติดต่อ"]?.toString().trim() || row["อีเมล"]?.toString().trim() || null;
  const phones = parsePhones(row["เบอร์โทร"]);
  const homeAddress = row["ที่อยู่ปัจจุบัน"]?.toString().trim() || null;
  const remarks = row["หมายเหตุ"]?.toString().trim() || null;

  if (!studentId || !prefix || !firstName || !lastName) {
    return { data: null, error: { row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" } };
  }
  if (!/^\d+$/.test(studentId)) {
    return { data: null, error: { row: rowNumber, message: "รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น" } };
  }

  return {
    data: {
      studentId,
      prefix,
      firstName,
      lastName,
      cohort,
      degreeLevel,
      major,
      graduationYear,
      birthDate,
      contactEmail,
      phones,
      homeAddress,
      remarks,
    },
    error: null,
  };
}

/**
 * The alumni UPDATE payload. The 8 core fields are written unconditionally; the
 * 4 export-only fields (`major`/`graduationYear`/`birthDate`/`remarks`) are
 * included ONLY when the row provided them — so a legacy import (or a re-import
 * of an export row with those cells blank) never blanks an alumni's existing
 * values. Returns a plain record (no `Prisma.*` type) to stay client-safe; the
 * route casts at the Prisma boundary.
 */
export function alumniUpdatePayload(r: AlumniImportRecord): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    prefix: r.prefix,
    firstName: r.firstName,
    lastName: r.lastName,
    cohort: r.cohort,
    degreeLevel: r.degreeLevel,
    contactEmail: r.contactEmail,
    phones: r.phones,
    homeAddress: r.homeAddress,
  };
  if (r.major !== null) payload.major = r.major;
  if (r.graduationYear !== null) payload.graduationYear = r.graduationYear;
  if (r.birthDate !== null) payload.birthDate = r.birthDate;
  if (r.remarks !== null) payload.remarks = r.remarks;
  return payload;
}

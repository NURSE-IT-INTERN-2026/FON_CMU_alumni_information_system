/**
 * Shared award Excel I/O contract — keeps the awards export columns and the
 * import write payload in one place so they can't drift, and so both behaviors
 * are unit-testable without a database. Client-safe (imports only
 * `AWARD_TYPE_LABELS` and a type from `award-import-parse`; no Prisma).
 */
import { AWARD_TYPE_LABELS } from "@/lib/constants";
import type { ParsedAwardRow } from "@/lib/award-import-parse";

/** Award fields an export row needs (loose so the helper stays client-safe). */
export interface AwardExportShape {
  studentId: string | null;
  pendingStudentId: string | null;
  prefix: string | null;
  firstName: string | null;
  lastName: string | null;
  major: string | null;
  awardName: string;
  awardType: string;
  year: number;
  link: string | null;
  description: string | null;
}

/**
 * Ordered award export columns — mirrors the awards management table's DATA
 * columns. `ลำดับ` (row number), `รูปภาพ` (image), and `จัดการ` (actions) are
 * intentionally excluded: the row number and actions aren't data, and the image
 * path is an internal upload path that shouldn't be exported (an import with no
 * `รูปภาพ` column preserves any existing image — see `awardWritePayload`).
 *
 * `buildExcelResponse` derives column order from `Object.keys(rows[0])`, so the
 * key order of `awardToExportRow` (below) IS the export column order.
 */
export const AWARD_EXPORT_COLUMNS = [
  "รหัสนักศึกษา",
  "สาขาวิชา",
  "คำนำหน้า",
  "ชื่อ",
  "นามสกุล",
  "ชื่อรางวัล",
  "ประเภท",
  "ปีที่ได้รับ",
  "ลิงค์",
  "รายละเอียด",
] as const;

/** Map an award row to an export row keyed by the headers above (in order). */
export function awardToExportRow(
  a: AwardExportShape
): Record<string, string | number> {
  return {
    "รหัสนักศึกษา": a.studentId || a.pendingStudentId || "",
    "สาขาวิชา": a.major || "",
    "คำนำหน้า": a.prefix ?? "",
    "ชื่อ": a.firstName ?? "",
    "นามสกุล": a.lastName ?? "",
    "ชื่อรางวัล": a.awardName,
    "ประเภท": AWARD_TYPE_LABELS[a.awardType] || a.awardType,
    "ปีที่ได้รับ": a.year,
    "ลิงค์": a.link || "",
    "รายละเอียด": a.description || "",
  };
}

/** Resolved link + parsed data needed to build a Prisma award write payload. */
export interface AwardWriteInput {
  data: ParsedAwardRow;
  studentId: string | null;
  pendingStudentId: string | null;
  major: string | null;
}

/**
 * The award write payload used on both create and update. `imageUrl` is included
 * ONLY when the import provides a non-blank value: on create an omitted nullable
 * column defaults to NULL (same as null), and on update omitting it preserves an
 * existing image — so a round-tripped export (no `รูปภาพ` column, parses to null)
 * doesn't blank an image that was set out-of-band.
 */
export function awardWritePayload(r: AwardWriteInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    studentId: r.studentId,
    pendingStudentId: r.pendingStudentId,
    prefix: r.data.prefix,
    firstName: r.data.firstName,
    lastName: r.data.lastName,
    awardName: r.data.awardName,
    awardType: r.data.awardType,
    year: r.data.year,
    link: r.data.link,
    description: r.data.description,
    major: r.major,
  };
  if (r.data.imageUrl) {
    payload.imageUrl = r.data.imageUrl;
  }
  return payload;
}

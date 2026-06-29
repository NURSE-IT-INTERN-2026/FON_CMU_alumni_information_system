/**
 * Activity-log detail presentation helpers — client-safe (no Prisma import).
 *
 * The System Logs page (`app/(admin)/management/settings/logs/page.tsx`) renders
 * `ActivityLog.details` (a free-form JSON column). Shapes in use across the API:
 *   - CREATE / DELETE  → small flat summary objects (`{ studentId, name }`, `{ title, status }`, …)
 *   - UPDATE           → `{ changes: [{ field, from, to }] }` (see `lib/field-changes.ts`)
 *   - (a few UPDATEs)  → a snapshot/summary instead of `changes`
 *
 * These helpers turn those English-keyed payloads into Thai-labeled rows and
 * pretty-print enum/typed values, so the column and modal never dump raw
 * `[object Object]` garbage.
 */
import { AWARD_TYPE_LABELS, DEGREE_LEVEL_OPTIONS } from "@/lib/constants";

/** English field key → Thai label. Unknown keys fall back to themselves. */
export const FIELD_LABELS: Record<string, string> = {
  // identity / person
  studentId: "รหัสนักศึกษา",
  name: "ชื่อ-นามสกุล",
  prefix: "คำนำหน้า",
  firstName: "ชื่อ",
  lastName: "นามสกุล",
  englishName: "ชื่อภาษาอังกฤษ",
  email: "อีเมล (เข้าสู่ระบบ)",
  contactEmail: "อีเมลติดต่อ",
  phones: "เบอร์โทรศัพท์",
  homeAddress: "ที่อยู่ปัจจุบัน",
  // education / degree
  degreeLevel: "ระดับการศึกษา",
  graduationYear: "ปีที่จบการศึกษา",
  major: "สาขาวิชา",
  cohort: "รุ่นที่",
  generation: "รุ่น",
  alumniId: "รหัสศิษย์เก่า",
  // award
  awardName: "ชื่อรางวัล",
  awardType: "ประเภทรางวัล",
  year: "ปี (พ.ศ.)",
  link: "ลิงก์",
  imageUrl: "รูปภาพ",
  description: "รายละเอียด",
  // association / committee / potential / agency
  associationName: "ชื่อสมาคม/ชมรม",
  position: "ตำแหน่ง",
  recordedYear: "ปีที่บันทึก",
  career: "อาชีพ",
  termYear: "ปี/วาระ",
  workplace: "สถานที่ทำงาน",
  country: "ประเทศ",
  // misc
  title: "ชื่อเรื่อง",
  status: "สถานะ",
  role: "บทบาท",
  remarks: "หมายเหตุ",
  notes: "หมายเหตุ",
  // import summary counts (rendered by ImportDetail; labels here are a fallback)
  fileName: "ไฟล์",
  attempted: "ทั้งหมดที่นำเข้า",
  created: "สร้างใหม่",
  updated: "อัปเดต",
  failed: "ผิดพลาด",
  imported: "นำเข้าแล้ว",
};

const NEWS_STATUS_LABELS: Record<string, string> = {
  DRAFT: "ร่าง",
  PUBLISHED: "เผยแพร่",
  DISCONTINUED: "ยุติเผยแพร่",
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: "ผู้ดูแลระบบสูงสุด",
  admin: "ผู้ดูแลระบบ",
};

/** Keys that are internal metadata, not user-facing data rows. */
const META_KEYS = new Set([
  "source",
  "sections",
  "changes",
  // IMPORT details: the record/error arrays + their cap flags are rendered by
  // the dedicated ImportDetail component (via `extractImportDetails`), not as
  // generic rows. (The scalar counts created/updated/failed/attempted/fileName
  // are left in so a fallback still shows something useful.)
  "records",
  "truncated",
  "totalRecords",
  "errorsTruncated",
  "totalErrors",
  "op",
]);

function labelFor(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Pretty-print a single value, typed by the field it belongs to. */
export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (field) {
    case "awardType":
      return AWARD_TYPE_LABELS[String(value)] ?? String(value);
    case "degreeLevel": {
      const found = DEGREE_LEVEL_OPTIONS.find((o) => o.value === String(value));
      return found?.label ?? String(value);
    }
    case "status":
      return NEWS_STATUS_LABELS[String(value)] ?? String(value);
    case "role":
      return ROLE_LABELS[String(value)] ?? String(value);
  }
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  if (value instanceof Date) return value.toLocaleString("th-TH");
  // Never stringify objects/arrays raw — show a placeholder so the UI can't
  // regress into `[object Object]`.
  if (typeof value === "object") return "—";
  return String(value);
}

export interface DetailRow {
  label: string;
  value: string;
}

/**
 * Turn a flat details object into labeled rows, dropping meta keys. Used for
 * CREATE / DELETE cards and the snapshot-fallback for UPDATE.
 */
export function detailRows(details: Record<string, unknown> | null): DetailRow[] {
  if (!details) return [];
  return Object.entries(details)
    .filter(([k]) => !META_KEYS.has(k))
    .map(([k, v]) => ({ label: labelFor(k), value: formatValue(k, v) }));
}

export interface FieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

/** Extract a normalized `changes[]` array from details, if present. */
export function extractChanges(details: Record<string, unknown> | null): FieldChange[] | null {
  if (!details) return null;
  const raw = details.changes;
  if (!Array.isArray(raw)) return null;
  return raw as FieldChange[];
}

export interface ImportRecordView {
  /** studentId when present (null for unlinked rows). */
  id: string | null;
  name: string;
  op: "created" | "updated";
}

export interface ImportErrorView {
  row: number;
  message: string;
}

export interface ImportDetailView {
  fileName: string | null;
  attempted: number;
  created: number;
  updated: number;
  failed: number;
  /** Legacy pre-redesign alumni imports stored only a combined `imported` count. */
  imported: number;
  records: ImportRecordView[];
  truncated: boolean;
  totalRecords: number;
  errors: ImportErrorView[];
  errorsTruncated: boolean;
  totalErrors: number;
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Read an IMPORT log's `details` into a typed view. Tolerates both the new
 * shape (records[] + created/updated) and the legacy alumni shape
 * (`{ imported, attempted, errors: <number> }`). Returns null when `details`
 * isn't import-shaped, so the caller can fall back to a generic card.
 */
export function extractImportDetails(details: Record<string, unknown> | null): ImportDetailView | null {
  if (!details) return null;
  const isImport =
    "records" in details ||
    "created" in details ||
    "updated" in details ||
    "attempted" in details ||
    "imported" in details;
  if (!isImport) return null;

  const recordsRaw = Array.isArray(details.records) ? details.records : [];
  const records: ImportRecordView[] = recordsRaw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      id: typeof r.id === "string" ? r.id : null,
      name: typeof r.name === "string" ? r.name : String(r.name ?? ""),
      op: r.op === "updated" ? "updated" : "created",
    }));

  const errorsRaw = Array.isArray(details.errors) ? details.errors : [];
  const errors: ImportErrorView[] = errorsRaw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      row: asNumber(e.row),
      message: typeof e.message === "string" ? e.message : String(e.message ?? ""),
    }));

  const totalRecords = asNumber(details.totalRecords);
  const totalErrors = asNumber(details.totalErrors);

  return {
    fileName: asString(details.fileName),
    attempted: asNumber(details.attempted),
    created: asNumber(details.created),
    updated: asNumber(details.updated),
    failed: asNumber(details.failed),
    imported: asNumber(details.imported),
    records,
    truncated: details.truncated === true,
    totalRecords: totalRecords || records.length,
    errors,
    errorsTruncated: details.errorsTruncated === true,
    totalErrors: totalErrors || errors.length,
  };
}

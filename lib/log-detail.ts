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
  email: "อีเมล",
  phone: "เบอร์โทรศัพท์",
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
const META_KEYS = new Set(["source", "sections", "changes"]);

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

/**
 * One-line human summary for the table's รายละเอียด column — prefers the most
 * identifying value present. Returns "" when nothing useful is logged.
 */
export function primaryIdentifier(details: Record<string, unknown> | null): string {
  if (!details) return "";
  const preferred = ["name", "title", "awardName", "associationName", "email", "studentId", "career", "workplace"];
  for (const key of preferred) {
    const v = details[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  // Fall back to the first non-meta scalar value.
  for (const [k, v] of Object.entries(details)) {
    if (META_KEYS.has(k)) continue;
    if (typeof v === "string" || typeof v === "number") return formatValue(k, v);
  }
  return "";
}

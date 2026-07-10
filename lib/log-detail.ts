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
  province: "จังหวัด",
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
  "sectionChanges",
  "changes",
  "action",
  "method",
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

// ---------------------------------------------------------------------------
// Description layer — one self-explanatory Thai sentence per activity log.
// Shared by the profile data-logs timeline and the System Logs page so every
// entry reads the same way on both surfaces.
// ---------------------------------------------------------------------------

const LOG_ACTION_LABELS: Record<string, string> = {
  CREATE: "เพิ่ม",
  UPDATE: "แก้ไข",
  DELETE: "ลบ",
  IMPORT: "นำเข้า",
  EXPORT: "ส่งออก",
  BULK_DELETE: "ลบหลายรายการ",
  SIGNUP: "สมัครสมาชิก",
  APPROVE: "อนุมัติ",
  REJECT: "ปฏิเสธ",
  RESTORE: "กู้คืน",
  SUSPEND: "ระงับ",
  HARD_DELETE: "ลบถาวร",
  REAPPLY: "ยื่นคำขอใหม่",
  VERIFY_IDENTITY: "ยืนยันตัวตน",
  PASSWORD_RESET_REQUEST: "ขอรีเซ็ตรหัสผ่าน",
  PASSWORD_RESET_COMPLETE: "รีเซ็ตรหัสผ่าน",
  EMAIL_VERIFY: "ยืนยันอีเมล",
  EMAIL_VERIFY_REQUEST: "ส่งอีเมลยืนยัน",
};

const LOG_RESOURCE_LABELS: Record<string, string> = {
  alumni: "ข้อมูลศิษย์เก่า",
  alumni_profile: "ข้อมูลส่วนตัว",
  education: "ประวัติการศึกษา",
  award: "ข้อมูลรางวัล",
  association: "สมาคม/ชมรม",
  graduate_committee: "กรรมการบัณฑิต",
  potential: "ศักยภาพ",
  model_representative: "ผู้แทนรุ่น",
  alumni_agency: "ข้อมูลการทำงานศิษย์เก่า",
  news: "ข่าว",
  user: "ผู้ใช้",
  alumni_auth: "บัญชีศิษย์เก่า",
  cmu_alumni: "ทะเบียน มช.",
};

const SECTION_LABELS: Record<string, string> = {
  awards: "ข้อมูลรางวัล",
  associations: "ข้อมูลสมาคม/ชมรม",
  graduateCommittees: "ข้อมูลกรรมการบัณฑิต",
  potentials: "ข้อมูลศักยภาพ",
  modelRepresentatives: "ข้อมูลผู้แทนรุ่น",
  alumniAgency: "ข้อมูลการทำงานศิษย์เก่า",
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/**
 * A clear Thai sentence for an `alumni_auth` (account/login) event.
 * `brief = true` (default for the surface line) → action label only, no
 * specifics. `brief = false` (modal) → full sentence with method/email/
 * CMU outcome/reject reason.
 */
export function describeAuthEvent(
  action: string,
  details: Record<string, unknown> | null,
  brief = false,
): string {
  const d = details ?? {};
  const actionDetail = str(d.action);
  switch (action) {
    case "LOGIN":
      return brief ? "เข้าสู่ระบบ" : `เข้าสู่ระบบ${str(d.method) === "email" ? "ด้วยอีเมล" : ""}`.trim();
    case "SIGNUP": {
      if (brief) return "สมัครสมาชิก";
      const parts = ["สมัครสมาชิก"];
      const email = str(d.email);
      if (email) parts.push(`(อีเมล ${email})`);
      const source = str(d.source);
      if (source === "cmu-not-found") parts.push("— ยังไม่พบในทะเบียน มช.");
      else if (source === "cmu") parts.push("— ตรงกับทะเบียน มช.");
      else if (source === "cmu-unavailable") parts.push("— ไม่สามารถติดต่อทะเบียน มช.");
      return parts.join(" ");
    }
    case "UPDATE":
      if (actionDetail === "accept_tos") return "ยอมรับเงื่อนไขการใช้งาน";
      return "อัปเดตบัญชีศิษย์เก่า";
    case "APPROVE":
      return "อนุมัติบัญชีศิษย์เก่า";
    case "REJECT":
      return brief || !str(d.reason)
        ? "ปฏิเสธบัญชีศิษย์เก่า"
        : `ปฏิเสธบัญชี: ${str(d.reason)}`;
    case "REAPPLY":
      return "ยื่นคำขอสมัครสมาชิกใหม่";
    case "SUSPEND":
      return "จัดการการระงับบัญชี";
    case "PASSWORD_RESET_REQUEST":
      return "ขอรีเซ็ตรหัสผ่าน";
    case "PASSWORD_RESET_COMPLETE":
      return "รีเซ็ตรหัสผ่าน";
    case "EMAIL_VERIFY":
      return "ยืนยันอีเมล";
    case "EMAIL_VERIFY_REQUEST":
      return "ส่งอีเมลยืนยันตัวตน";
    case "VERIFY_IDENTITY":
      return "ยืนยันตัวตน";
    default:
      return "บัญชีศิษย์เก่า";
  }
}

export interface SectionChangeView {
  label: string;
  added: string[];
  removed: string[];
}

/** Structured read of `details.sectionChanges` for full (added/removed) render. */
export function readSectionChanges(details: unknown): SectionChangeView[] {
  if (typeof details !== "object" || details === null) return [];
  const sc = (details as { sectionChanges?: Record<string, { added?: unknown[]; removed?: unknown[] }> }).sectionChanges;
  if (!sc || typeof sc !== "object") return [];
  const out: SectionChangeView[] = [];
  for (const [key, val] of Object.entries(sc)) {
    if (!val || typeof val !== "object") continue;
    const added = Array.isArray(val.added) ? val.added.filter((x): x is string => typeof x === "string") : [];
    const removed = Array.isArray(val.removed) ? val.removed.filter((x): x is string => typeof x === "string") : [];
    if (added.length === 0 && removed.length === 0) continue;
    out.push({ label: SECTION_LABELS[key] ?? key, added, removed });
  }
  return out;
}

/** Legacy fallback: read the old `sections` counts (pre-sectionChanges logs) →
 *  "ข้อมูลรางวัล 1, ข้อมูลสมาคม/ชมรม 2". Null when there are no non-zero counts. */
export function sectionCountSummary(details: unknown): string | null {
  const entries = sectionCountEntries(details);
  if (entries.length === 0) return null;
  return entries.map((e) => `${e.label} ${e.count}`).join(", ");
}

/** Structured read of the legacy `sections` counts (non-zero only). */
export function sectionCountEntries(details: unknown): { label: string; count: number }[] {
  if (typeof details !== "object" || details === null) return [];
  const sections = (details as { sections?: Record<string, number> }).sections;
  if (!sections || typeof sections !== "object") return [];
  const out: { label: string; count: number }[] = [];
  for (const [key, n] of Object.entries(sections)) {
    if (typeof n === "number" && n > 0) out.push({ label: SECTION_LABELS[key] ?? key, count: n });
  }
  return out;
}

/**
 * Surface label for an alumni self-edit (`alumni_profile` UPDATE) — names the
 * section(s) touched: "เพิ่มข้อมูลรางวัล" / "แก้ไขข้อมูลรางวัล" / "ลบข้อมูลรางวัล".
 * Uses `sectionChanges` (precise verb) when present, else falls back to the
 * legacy `sections` counts ("แก้ไข…", verb unknown). Core-field changes are
 * appended. Empty → "แก้ไขข้อมูลส่วนตัว".
 */
function selfEditSurfaceLabel(details: Record<string, unknown> | null): string {
  const parts: string[] = [];
  const sectionRows = readSectionChanges(details);
  if (sectionRows.length > 0) {
    for (const s of sectionRows) {
      const verb = s.added.length > 0 && s.removed.length > 0 ? "แก้ไข" : s.added.length > 0 ? "เพิ่ม" : "ลบ";
      parts.push(verb + s.label);
    }
  } else {
    for (const e of sectionCountEntries(details)) parts.push("แก้ไข" + e.label);
  }
  const core = extractChanges(details);
  if (core && core.length > 0) {
    parts.push("แก้ไข" + core.map((c) => FIELD_LABELS[c.field] ?? c.field).join(", "));
  }
  return parts.length > 0 ? parts.join(", ") : "แก้ไขข้อมูลส่วนตัว";
}

/**
 * One TERSE Thai sentence for an activity log entry — the surface/list line on
 * both the profile timeline and the System Logs page. Shows the ACTION only
 * (action + field-name(s) for alumni core edits, action + resource otherwise,
 * + degree tag for education creates, action label only for auth). All data
 * values (old→new, names, ids, emails, section counts) live in the modal.
 */
export function describeActivityLog(args: {
  action: string;
  resource: string;
  details?: Record<string, unknown> | null;
}): string {
  const { action, resource } = args;
  const details: Record<string, unknown> | null = args.details ?? null;
  const resourceLabel = LOG_RESOURCE_LABELS[resource] ?? resource;

  if (resource === "alumni_auth") return describeAuthEvent(action, details, true);

  if (action === "UPDATE") {
    // Alumni core edits name the field(s); everything else is action + resource.
    if (resource === "alumni") {
      const changes = extractChanges(details);
      if (changes && changes.length > 0) {
        return "แก้ไข" + changes.map((c) => FIELD_LABELS[c.field] ?? c.field).join(", ");
      }
    }
    // Self-edit names the section(s) touched (เพิ่ม/แก้ไข/ลบข้อมูลรางวัล, …).
    if (resource === "alumni_profile") {
      return selfEditSurfaceLabel(details);
    }
    return "แก้ไข" + resourceLabel;
  }

  if (action === "CREATE") {
    if (resource === "education") {
      const deg = formatValue("degreeLevel", details?.degreeLevel);
      return "เพิ่ม" + resourceLabel + (deg && deg !== "—" ? ` ${deg}` : "");
    }
    return "เพิ่ม" + resourceLabel;
  }
  if (action === "DELETE" || action === "HARD_DELETE") return "ลบ" + resourceLabel;

  if (action === "IMPORT") return "นำเข้า" + resourceLabel;

  const actionLabel = LOG_ACTION_LABELS[action] ?? action;
  return actionLabel + resourceLabel;
}

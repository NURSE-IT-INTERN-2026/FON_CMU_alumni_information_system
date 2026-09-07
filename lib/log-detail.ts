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
import type { LogAction, LogResource } from "@/lib/log-types";

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
  pinnedAt: "การปักหมุด",
  pinned: "การปักหมุด",
  role: "บทบาท",
  remarks: "หมายเหตุ",
  notes: "หมายเหตุ",
  phone: "เบอร์โทรศัพท์",
  reason: "เหตุผล",
  alumniName: "ชื่อศิษย์เก่า",
  // community (V2) context — human labels logged alongside hidden uuid keys
  topicTitle: "หัวข้อกระทู้",
  postSnippet: "ตัวอย่างเนื้อหาโพสต์",
  eventTitle: "ชื่อกิจกรรม",
  groupTitle: "ชื่อกลุ่ม",
  guestCount: "จำนวนแขกที่นำมาด้วย",
  slug: "ชื่อย่อกลุ่ม (slug)",
  moderation: "ดำเนินการโดยผู้ดูแล",
  resourceType: "ประเภทเนื้อหาที่รายงาน",
  updatedFields: "ส่วนที่แก้ไข",
  // export / bulk-operation summaries
  count: "จำนวน",
  search: "คำค้นหา",
  mode: "ช่วงข้อมูล",
  range: "ช่วงแถว",
  merged: "รวมข้อมูลจากทะเบียน มช.",
  dedupe: "กรองซ้ำรายบุคคล",
  bulk: "การดำเนินการ",
  unpinned: "จำนวนที่ยกเลิกปักหมุด",
  // auto-link (LINK) summaries
  linkedCount: "จำนวนที่เชื่อมโยง",
  homeMigrated: "ย้ายที่อยู่บ้านมายังข้อมูลศิษย์เก่า",
  // trash restore / hard-delete
  entity: "ประเภทรายการ",
  // import summary counts (rendered by ImportDetail; labels here are a fallback)
  fileName: "ไฟล์",
  attempted: "ทั้งหมดที่นำเข้า",
  created: "สร้างใหม่",
  updated: "อัปเดต",
  failed: "ผิดพลาด",
  imported: "นำเข้าแล้ว",
};

// Merged Thai map for every enum-ish token writers store under `status`
// (news DRAFT/PUBLISHED/DISCONTINUED + event RSVP ATTENDING/DECLINED). Tokens
// don't collide today; if a future status token is reused with a different
// meaning, split per-resource instead of extending this map.
const STATUS_VALUE_LABELS: Record<string, string> = {
  DRAFT: "ร่าง",
  PUBLISHED: "เผยแพร่",
  DISCONTINUED: "ยุติเผยแพร่",
  ATTENDING: "เข้าร่วม",
  DECLINED: "ไม่เข้าร่วม",
};

const REPORT_RESOURCE_TYPE_LABELS: Record<string, string> = {
  FORUM_TOPIC: "กระทู้",
  FORUM_REPLY: "ความคิดเห็นในกระทู้",
  EVENT: "กิจกรรม",
  FEED_POST: "โพสต์",
  FEED_COMMENT: "ความคิดเห็น",
  JOB_POSTING: "ประกาศงาน",
  EVENT_PHOTO: "รูปภาพกิจกรรม",
};

const EXPORT_MODE_LABELS: Record<string, string> = {
  filtered: "ตามเงื่อนไขที่กรอง",
  selected: "รายการที่เลือก",
};

const BULK_OP_LABELS: Record<string, string> = {
  pin: "ปักหมุด",
  publish: "เผยแพร่",
};

// Kebab trash-entity slug → Thai. Mirrors the keys of `TRASH_ENTITIES` in
// `lib/trash.ts` (which imports Prisma, so the labels are duplicated here on
// purpose — keep both in sync when an entity is added).
const TRASH_ENTITY_LABELS: Record<string, string> = {
  alumni: "ข้อมูลนักศึกษาเก่า",
  awards: "รางวัล",
  associations: "สมาคม/ชมรม",
  "graduate-committee": "กรรมการบัณฑิต",
  "model-representatives": "ผู้แทนรุ่น",
  potentials: "ศักยภาพ",
  "alumni-agency": "ข้อมูลการทำงานศิษย์เก่า",
  "forum-topic": "กระทู้",
  "forum-reply": "ความคิดเห็น",
  "community-event": "กิจกรรม",
  "feed-post": "โพสต์",
  "feed-comment": "ความคิดเห็น",
  "community-group": "กลุ่มศิษย์เก่า",
  "job-posting": "ประกาศงาน",
  "event-photo": "รูปภาพกิจกรรม",
  announcement: "ประกาศชุมชน",
};

// `details.updatedFields` (community-profile self-edits) carries raw English
// column names — mapped to Thai at render.
const COMMUNITY_PROFILE_FIELD_LABELS: Record<string, string> = {
  photoUrl: "รูปโปรไฟล์",
  currentWorkplace: "สถานที่ทำงานปัจจุบัน",
  currentPosition: "ตำแหน่งงานปัจจุบัน",
  province: "จังหวัด",
  country: "ประเทศ",
  bio: "แนะนำตัว",
  contactEmail: "อีเมลติดต่อ",
  facebookUrl: "Facebook",
  lineId: "LINE ID",
  linkedinUrl: "LinkedIn",
  otherLink: "ลิงก์อื่น ๆ",
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
  // uuid joins / object payloads — machine identifiers, never human-useful.
  // Where they matter, writers log a sibling Thai-labeled title/snippet.
  "topicId",
  "postId",
  "eventId",
  "groupId",
  "reportId",
  "resourceId",
  "alumniId",
  "ids",
  "homeMigratedFrom",
  "perEntity",
  // IMPORT details: the error array + its cap flags are rendered by the
  // dedicated ImportDetail component (via `extractImportDetails`), not as
  // generic rows. (The scalar counts created/updated/failed/attempted/fileName
  // are left in so a fallback still shows something useful.)
  "errors",
  "errorsTruncated",
  "totalErrors",
  "op",
]);

function labelFor(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Pretty-print a single value, typed by the field it belongs to. */
export function formatValue(field: string, value: unknown): string {
  // pinnedAt is a timestamp-or-null whose meaning is the pin STATE, not a date.
  // Handle before the null early-return so "unpinned" shows as "ไม่ได้ปักหมุด".
  if (field === "pinnedAt") return value == null || value === "" ? "ไม่ได้ปักหมุด" : "ปักหมุด";
  // `pinned` is overloaded: a COUNT in news bulk-pin logs, a boolean elsewhere.
  // Number check first, or a count like 3 renders as "ไม่ได้ปักหมุด".
  if (field === "pinned") {
    if (typeof value === "number") return `${value} รายการ`;
    return value === true || value === "true" ? "ปักหมุด" : "ไม่ได้ปักหมุด";
  }
  if (value === null || value === undefined || value === "") return "—";
  switch (field) {
    case "awardType":
      return AWARD_TYPE_LABELS[String(value)] ?? String(value);
    case "degreeLevel": {
      const found = DEGREE_LEVEL_OPTIONS.find((o) => o.value === String(value));
      return found?.label ?? String(value);
    }
    case "status":
      return STATUS_VALUE_LABELS[String(value)] ?? String(value);
    case "role":
      return ROLE_LABELS[String(value)] ?? String(value);
    case "resourceType":
      return REPORT_RESOURCE_TYPE_LABELS[String(value)] ?? String(value);
    case "mode":
      return EXPORT_MODE_LABELS[String(value)] ?? String(value);
    case "bulk":
      return BULK_OP_LABELS[String(value)] ?? String(value);
    case "entity":
      return TRASH_ENTITY_LABELS[String(value)] ?? String(value);
    case "updatedFields": {
      // Array of raw English column names (community-profile self-edits) →
      // Thai-joined list so the log isn't content-free.
      if (Array.isArray(value)) {
        const labels = value
          .map((f) => COMMUNITY_PROFILE_FIELD_LABELS[String(f)] ?? FIELD_LABELS[String(f)] ?? String(f));
        return labels.length > 0 ? labels.join(", ") : "—";
      }
      return String(value);
    }
    case "range": {
      // Export row-window `{ start, end, total }` → one readable sentence.
      if (typeof value === "object" && value !== null) {
        const r = value as { start?: unknown; end?: unknown; total?: unknown };
        const start = Number(r.start);
        const end = Number(r.end);
        const total = Number(r.total);
        if ([start, end, total].every(Number.isFinite)) {
          return `แถว ${start}–${end} จาก ${total} แถว`;
        }
      }
      return "—";
    }
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
 * Read an IMPORT log's `details` into a typed view (counts + failed rows).
 * Tolerates the legacy alumni shape (`{ imported, attempted, errors: <number> }`)
 * and any pre-cleanup `records` key (ignored). Returns null when `details`
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

  const errorsRaw = Array.isArray(details.errors) ? details.errors : [];
  const errors: ImportErrorView[] = errorsRaw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      row: asNumber(e.row),
      message: typeof e.message === "string" ? e.message : String(e.message ?? ""),
    }));

  const totalErrors = asNumber(details.totalErrors);

  return {
    fileName: asString(details.fileName),
    attempted: asNumber(details.attempted),
    created: asNumber(details.created),
    updated: asNumber(details.updated),
    failed: asNumber(details.failed),
    imported: asNumber(details.imported),
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

// Typed as Record<LogAction/LogResource, string> so adding a new action or
// resource without a Thai label is a COMPILE error, not a raw-string leak.
export const LOG_ACTION_LABELS: Record<LogAction, string> = {
  CREATE: "เพิ่ม",
  UPDATE: "แก้ไข",
  DELETE: "ลบ",
  IMPORT: "นำเข้า",
  EXPORT: "ส่งออก",
  BULK_DELETE: "ลบหลายรายการ",
  SIGNUP: "สมัครสมาชิก",
  LOGIN: "เข้าสู่ระบบ",
  EMAIL_VERIFY_REQUEST: "ส่งอีเมลยืนยัน",
  EMAIL_VERIFY: "ยืนยันอีเมล",
  PASSWORD_RESET_REQUEST: "ขอรีเซ็ตรหัสผ่าน",
  PASSWORD_RESET_COMPLETE: "รีเซ็ตรหัสผ่าน",
  APPROVE: "อนุมัติ",
  REJECT: "ปฏิเสธ",
  REAPPLY: "ยื่นคำขอใหม่",
  VERIFY_IDENTITY: "ยืนยันตัวตน",
  RESTORE: "กู้คืน",
  SUSPEND: "ระงับ",
  HARD_DELETE: "ลบถาวร",
  LINK: "เชื่อมโยงรายการที่ค้างอยู่",
  OPT_IN: "สมัครเข้าร่วม",
  OPT_OUT: "ยกเลิกการเข้าร่วม",
  REPORT: "รายงาน",
  RESOLVE: "ดำเนินการรายงาน",
  DISMISS: "ยกเลิกรายงาน",
};

export const LOG_RESOURCE_LABELS: Record<LogResource, string> = {
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
  forum_topic: "กระทู้",
  forum_reply: "ความคิดเห็น",
  community: "ชุมชนศิษย์เก่า",
  content_report: "รายงานเนื้อหา",
  community_event: "กิจกรรม",
  event_rsvp: "การลงทะเบียนเข้าร่วมกิจกรรม",
  feed_post: "โพสต์",
  feed_comment: "ความคิดเห็น",
  community_profile: "โปรไฟล์ชุมชนศิษย์เก่า",
  community_group: "กลุ่มศิษย์เก่า",
  group_membership: "สมาชิกกลุ่ม",
  job_posting: "ประกาศงาน",
  event_photo: "รูปภาพกิจกรรม",
  announcement: "ประกาศชุมชน",
};

/** Labels for resources that exist only in pre-rename log rows. */
export const LEGACY_RESOURCE_LABELS: Record<string, string> = {
  abroad_alumni: "ข้อมูลการทำงานศิษย์เก่า", // pre-rename alumni-agency rows
};

/** Badge color per action (System Logs page action column). */
export const LOG_ACTION_COLORS: Record<LogAction, string> = {
  CREATE: "bg-purple-100 text-purple-700",
  LOGIN: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-yellow-100 text-yellow-700",
  DELETE: "bg-red-100 text-red-700",
  BULK_DELETE: "bg-red-100 text-red-700",
  IMPORT: "bg-purple-100 text-purple-700",
  EXPORT: "bg-indigo-100 text-indigo-700",
  SIGNUP: "bg-sky-100 text-sky-700",
  EMAIL_VERIFY: "bg-emerald-100 text-emerald-700",
  EMAIL_VERIFY_REQUEST: "bg-sky-100 text-sky-700",
  PASSWORD_RESET_REQUEST: "bg-sky-100 text-sky-700",
  PASSWORD_RESET_COMPLETE: "bg-emerald-100 text-emerald-700",
  APPROVE: "bg-green-100 text-green-700",
  REJECT: "bg-red-100 text-red-700",
  REAPPLY: "bg-sky-100 text-sky-700",
  VERIFY_IDENTITY: "bg-emerald-100 text-emerald-700",
  SUSPEND: "bg-amber-100 text-amber-700",
  RESTORE: "bg-green-100 text-green-700",
  HARD_DELETE: "bg-red-100 text-red-700",
  LINK: "bg-violet-100 text-violet-700",
  OPT_IN: "bg-emerald-100 text-emerald-700",
  OPT_OUT: "bg-gray-200 text-gray-700",
  REPORT: "bg-amber-100 text-amber-700",
  RESOLVE: "bg-green-100 text-green-700",
  DISMISS: "bg-gray-200 text-gray-700",
};

/** Thai label for an action — shared map → raw string as last resort. */
export function actionLabel(action: string): string {
  return LOG_ACTION_LABELS[action as LogAction] ?? action;
}

/** Thai label for a resource — shared map → legacy aliases → raw string. */
export function resourceLabel(resource: string): string {
  return (
    LOG_RESOURCE_LABELS[resource as LogResource] ??
    LEGACY_RESOURCE_LABELS[resource] ??
    resource
  );
}

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
  const resourceLabelText = resourceLabel(resource);

  if (resource === "alumni_auth") return describeAuthEvent(action, details, true);

  if (action === "UPDATE") {
    // Alumni core edits name the field(s); everything else is action + resource.
    if (resource === "alumni") {
      const changes = extractChanges(details);
      if (changes && changes.length > 0) {
        return "แก้ไข" + changes.map((c) => FIELD_LABELS[c.field] ?? c.field).join(", ");
      }
    }
    // News edits name the changed field(s) — e.g. "แก้ไขการปักหมุด", "แก้ไขสถานะ".
    if (resource === "news") {
      const changes = extractChanges(details);
      if (changes && changes.length > 0) {
        return "แก้ไข" + changes.map((c) => FIELD_LABELS[c.field] ?? c.field).join(", ");
      }
    }
    // Self-edit names the section(s) touched (เพิ่ม/แก้ไข/ลบข้อมูลรางวัล, …).
    if (resource === "alumni_profile") {
      return selfEditSurfaceLabel(details);
    }
    return "แก้ไข" + resourceLabelText;
  }

  if (action === "CREATE") {
    if (resource === "education") {
      const deg = formatValue("degreeLevel", details?.degreeLevel);
      return "เพิ่ม" + resourceLabelText + (deg && deg !== "—" ? ` ${deg}` : "");
    }
    return "เพิ่ม" + resourceLabelText;
  }
  if (action === "DELETE" || action === "HARD_DELETE") return "ลบ" + resourceLabelText;

  if (action === "IMPORT") return "นำเข้า" + resourceLabelText;

  if (action === "LINK") {
    const count = details?.linkedCount;
    const base = LOG_ACTION_LABELS.LINK;
    return typeof count === "number" ? `${base} ${count} รายการ` : base;
  }

  // Standalone sentences — the resource suffix would duplicate meaning
  // ("เข้าสู่ระบบผู้ใช้", "ดำเนินการรายงานรายงานเนื้อหา").
  if (action === "LOGIN") return LOG_ACTION_LABELS.LOGIN;
  if (action === "OPT_IN" || action === "OPT_OUT" || action === "RESOLVE" || action === "DISMISS") {
    return LOG_ACTION_LABELS[action];
  }

  return actionLabel(action) + resourceLabelText;
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { detailRows } from "@/lib/log-detail";

/**
 * Merged change timeline for one alumni — the "data logs" tab on the admin
 * alumni profile page (PRD §3.18). Fed by GET /api/alumni/[id]/activity, which
 * unions per-field change history (alumni core + related rows; orphans only)
 * with activity-log events. Newest first. Clicking a row opens a detail modal
 * (field-level old→new for edits, or the created record's fields for creates).
 */

type ActorType = "ADMIN" | "ALUMNI" | "SYSTEM";

// Thai labels for the tracked fields. Falls back to the raw field name.
const FIELD_LABELS: Record<string, string> = {
  prefix: "คำนำหน้า",
  firstName: "ชื่อ",
  lastName: "นามสกุล",
  englishName: "ชื่อภาษาอังกฤษ",
  studentId: "รหัสนักศึกษา",
  cohort: "รุ่นที่",
  generation: "ลำดับรุ่น",
  degreeLevel: "ระดับการศึกษา",
  major: "สาขาวิชา",
  graduationYear: "ปีที่จบ",
  email: "อีเมล",
  contactEmail: "อีเมลติดต่อ",
  phones: "เบอร์โทรศัพท์",
  phone: "เบอร์โทรศัพท์",
  workplace: "สถานที่ทำงาน",
  country: "ประเทศ",
  homeAddress: "ที่อยู่ปัจจุบัน",
  remarks: "หมายเหตุ",
  notes: "หมายเหตุ",
  awardName: "ชื่อรางวัล",
  awardType: "ประเภทรางวัล",
  year: "ปี (พ.ศ.)",
  recordedYear: "ปีที่บันทึก (พ.ศ.)",
  termYear: "ปี พ.ศ.",
  description: "รายละเอียด",
  associationName: "ชื่อสมาคม/ชมรม",
  position: "ตำแหน่ง",
  career: "อาชีพ",
  link: "ลิงก์",
  imageUrl: "รูปภาพ",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "เพิ่ม",
  UPDATE: "แก้ไข",
  DELETE: "ลบ",
  IMPORT: "นำเข้า",
  EXPORT: "ส่งออก",
  BULK_DELETE: "ลบหลายรายการ",
  SIGNUP: "สมัครสมาชิก",
  PASSWORD_RESET_REQUEST: "ขอรีเซ็ตรัหัสผ่าน",
  PASSWORD_RESET_COMPLETE: "รีเซ็ตรหัสผ่าน",
  APPROVE: "อนุมัติ",
  REJECT: "ปฏิเสธ",
  VERIFY_IDENTITY: "ยืนยันตัวตน",
  RESTORE: "กู้คืน",
  SUSPEND: "ระงับ",
  HARD_DELETE: "ลบถาวร",
};

const RESOURCE_LABELS: Record<string, string> = {
  alumni: "ข้อมูลศิษย์เก่า",
  alumni_profile: "ข้อมูลส่วนตัว",
  education: "การศึกษา",
  award: "รางวัล",
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

/** Thai title for an `alumni_auth` lifecycle event (account/login), or null. */
function authEventTitle(action: string, details: unknown): string | null {
  const actionDetail =
    typeof details === "object" && details !== null
      ? (details as { action?: string }).action
      : undefined;
  switch (action) {
    case "LOGIN":
      return "เข้าสู่ระบบ";
    case "SIGNUP":
      return "สมัครสมาชิก";
    case "APPROVE":
      return "อนุมัติบัญชี";
    case "REJECT":
      return "ปฏิเสธบัญชี";
    case "REAPPLY":
      return "ยื่นคำขอใหม่";
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
    case "UPDATE":
      if (actionDetail === "accept_tos") return "ยอมรับเงื่อนไขการใช้งาน";
      return null;
    default:
      return null;
  }
}

interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

interface FieldItem {
  kind: "field";
  id: string;
  createdAt: string;
  resourceType: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actorType: ActorType;
  actorName: string | null;
  reason: string | null;
}

interface ActivityItem {
  kind: "activity";
  id: string;
  createdAt: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorType: ActorType;
  actorName: string | null;
  reason: string | null;
  details: unknown;
  changes: FieldChange[];
}

export type TimelineItem = FieldItem | ActivityItem;

const fmt = (s: string) =>
  new Date(s).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

function ActorBadge({ actorType }: { actorType: ActorType }) {
  const cls =
    actorType === "ALUMNI"
      ? "bg-purple-100 text-purple-700"
      : actorType === "SYSTEM"
        ? "bg-gray-200 text-gray-700"
        : "bg-blue-100 text-blue-700";
  const label =
    actorType === "ALUMNI" ? "ศิษย์เก่า" : actorType === "SYSTEM" ? "ระบบ" : "ผู้ดูแล";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

/** Field changes for an activity item: linked rows, else the `details.changes`
 *  snapshot some routes embed (which uses `{field, from, to}` — normalized here
 *  to the linked `{field, oldValue, newValue}` shape). Empty for creates / auth. */
function effectiveChanges(item: ActivityItem): FieldChange[] {
  if (item.changes.length > 0) return item.changes;
  const details = item.details as Record<string, unknown> | null;
  const raw = details?.changes;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      field: String(c.field ?? ""),
      oldValue: c.from == null ? null : String(c.from),
      newValue: c.to == null ? null : String(c.to),
    }));
}

const SECTION_LABELS: Record<string, string> = {
  awards: "รางวัล",
  associations: "สมาคม/ชมรม",
  graduateCommittees: "กรรมการบัณฑิต",
  potentials: "ศักยภาพ",
  modelRepresentatives: "ผู้แทนรุ่น",
  alumniAgency: "ข้อมูลการทำงานศิษย์เก่า",
};

/** For alumni self-edits that only touched related sections (no core field
 *  change), summarize which sections were updated — avoids an empty modal. */
function sectionsSummary(details: unknown): string[] {
  if (typeof details !== "object" || details === null) return [];
  const sections = (details as { sections?: Record<string, number> }).sections;
  if (!sections || typeof sections !== "object") return [];
  return Object.entries(sections)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([k, n]) => `${SECTION_LABELS[k] ?? k} ${n} รายการ`);
}

/** One-line Thai title for a timeline row (used in the list + modal header). */
function itemTitle(item: TimelineItem): string {
  if (item.kind === "field") {
    return `แก้ไข${FIELD_LABELS[item.field] ?? item.field}`;
  }
  const auth =
    item.resource === "alumni_auth"
      ? authEventTitle(item.action, item.details)
      : null;
  if (auth) return auth;
  if (item.action === "UPDATE") {
    const changed = effectiveChanges(item);
    if (changed.length > 0) {
      return `แก้ไข${changed.map((c) => FIELD_LABELS[c.field] ?? c.field).join(", ")}`;
    }
  }
  // CREATE → "เพิ่มการศึกษา" / "เพิ่มข้อมูลศิษย์เก่า"; other actions keep a space.
  const action = ACTION_LABELS[item.action] ?? item.action;
  const resource = RESOURCE_LABELS[item.resource] ?? item.resource;
  return `${action}${resource}`;
}

export default function AlumniActivityTimeline({ alumniId }: { alumniId: string }) {
  const [selected, setSelected] = useState<TimelineItem | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.alumniProfile.activity(alumniId),
    queryFn: () =>
      apiFetch<{ items: TimelineItem[] }>(`/api/alumni/${alumniId}/activity`),
  });

  const items = data?.items ?? [];

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-[var(--danger)]">
        ไม่สามารถโหลดประวัติการเปลี่ยนแปลงได้
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted)]">
        ไม่มีประวัติการเปลี่ยนแปลง
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((item) => (
          <button
            type="button"
            key={`${item.kind}-${item.id}`}
            onClick={() => setSelected(item)}
            className="block w-full rounded-lg border border-[var(--border)] bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <ActorBadge actorType={item.actorType} />
              <span>{fmt(item.createdAt)}</span>
              {item.actorName && <span>• {item.actorName}</span>}
            </div>

            <div className="text-sm font-medium text-[var(--foreground)]">
              {itemTitle(item)}
              {item.kind === "field" &&
                item.resourceType !== "alumni" &&
                item.resourceType !== "alumni_profile" && (
                  <span className="ml-1 text-[var(--muted)]">
                    ({RESOURCE_LABELS[item.resourceType] ?? item.resourceType})
                  </span>
                )}
            </div>

            {/* Inline old→new for a single field-change row. */}
            {item.kind === "field" && (
              <div className="mt-1 text-sm">
                <span className="text-gray-400 line-through">{item.oldValue || "—"}</span>
                <span className="mx-1.5 font-semibold text-orange-500">→</span>
                <span className="text-gray-800">{item.newValue || "—"}</span>
              </div>
            )}

            {item.reason && <div className="mt-1 text-xs text-[var(--muted)]">เหตุผล: {item.reason}</div>}
          </button>
        ))}
      </div>

      {selected && <ActivityDetailModal item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function ActivityDetailModal({ item, onClose }: { item: TimelineItem; onClose: () => void }) {
  const changes: FieldChange[] =
    item.kind === "activity"
      ? effectiveChanges(item)
      : [{ field: item.field, oldValue: item.oldValue, newValue: item.newValue }];
  const details =
    item.kind === "activity" ? (item.details as Record<string, unknown> | null) : null;
  // For creates / auth events there are no old→new pairs — show the carried
  // record fields as flat labeled rows instead.
  const rows = changes.length === 0 ? detailRows(details) : [];
  const sections = changes.length === 0 && rows.length === 0 ? sectionsSummary(details) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            {itemTitle(item)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          <ActorBadge actorType={item.actorType} />
          <span>{fmt(item.createdAt)}</span>
          {item.actorName && <span>• {item.actorName}</span>}
        </div>

        {changes.length > 0 ? (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {changes.map((c, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] bg-gray-50 p-3 text-sm">
                <div className="text-xs font-medium text-[var(--muted)]">
                  {FIELD_LABELS[c.field] ?? c.field}
                </div>
                <div className="mt-1">
                  <span className="text-gray-400 line-through">{c.oldValue || "—"}</span>
                  <span className="mx-1.5 font-semibold text-orange-500">→</span>
                  <span className="text-gray-800">{c.newValue || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : rows.length > 0 ? (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] bg-gray-50 p-3 text-sm">
                <div className="text-xs font-medium text-[var(--muted)]">{r.label}</div>
                <div className="mt-1 text-gray-800">{r.value}</div>
              </div>
            ))}
          </div>
        ) : sections.length > 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-gray-50 p-3 text-sm text-gray-800">
            รายการที่อัปเดต: {sections.join(", ")}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">ไม่มีรายละเอียดเพิ่มเติม</p>
        )}

        {item.reason && (
          <div className="mt-3 text-xs text-[var(--muted)]">เหตุผล: {item.reason}</div>
        )}
      </div>
    </div>
  );
}

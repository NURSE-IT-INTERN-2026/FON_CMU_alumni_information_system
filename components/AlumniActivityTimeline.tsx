"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/**
 * Merged change timeline for one alumni — the "data logs" tab on the admin
 * alumni profile page (PRD §3.18). Fed by GET /api/alumni/[id]/activity, which
 * unions per-field change history (alumni core + related rows + education) with
 * activity-log events (incl. SYSTEM graduation logs). Newest first. Clicking a
 * row opens a changes modal (field-level old→new).
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
  PASSWORD_RESET_REQUEST: "ขอรีเซ็ตรหัสผ่าน",
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
  alumni_auth: "การเข้าสู่ระบบ",
  cmu_alumni: "ทะเบียน มช.",
};

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

// A SYSTEM education log is a graduation event (reason = "สำเร็จการศึกษา …").
function isGraduation(item: TimelineItem): boolean {
  return item.kind === "activity" && item.actorType === "SYSTEM" && item.resource === "education";
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
        {items.map((item) => {
          const grad = isGraduation(item);
          return (
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

              {item.kind === "field" ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    แก้ไข{FIELD_LABELS[item.field] ?? item.field}
                    {item.resourceType !== "alumni" && item.resourceType !== "alumni_profile" && (
                      <span className="ml-1 text-[var(--muted)]">
                        ({RESOURCE_LABELS[item.resourceType] ?? item.resourceType})
                      </span>
                    )}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-400 line-through">{item.oldValue || "—"}</span>
                    <span className="mx-1.5 font-semibold text-orange-500">→</span>
                    <span className="text-gray-800">{item.newValue || "—"}</span>
                  </div>
                </div>
              ) : grad ? (
                <div className="text-sm font-medium text-[var(--foreground)]">
                  {item.reason ?? `${ACTION_LABELS[item.action] ?? item.action} ${RESOURCE_LABELS[item.resource] ?? item.resource}`}
                </div>
              ) : (
                <div className="text-sm font-medium text-[var(--foreground)]">
                  {ACTION_LABELS[item.action] ?? item.action}{" "}
                  {RESOURCE_LABELS[item.resource] ?? item.resource}
                </div>
              )}

              {item.reason && !grad && (
                <div className="mt-1 text-xs text-[var(--muted)]">เหตุผล: {item.reason}</div>
              )}
            </button>
          );
        })}
      </div>

      {selected && <ActivityDetailModal item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function ActivityDetailModal({ item, onClose }: { item: TimelineItem; onClose: () => void }) {
  const changes: FieldChange[] =
    item.kind === "activity"
      ? item.changes
      : [{ field: item.field, oldValue: item.oldValue, newValue: item.newValue }];
  const grad = isGraduation(item);

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
            {grad ? "รายละเอียดการสำเร็จการศึกษา" : "รายละเอียดการเปลี่ยนแปลง"}
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

        {grad && item.reason && (
          <p className="mb-3 text-sm font-medium text-[var(--foreground)]">{item.reason}</p>
        )}

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
        ) : (
          <p className="text-sm text-[var(--muted)]">ไม่มีรายละเอียดระดับฟิลด์</p>
        )}

        {item.reason && !grad && (
          <div className="mt-3 text-xs text-[var(--muted)]">เหตุผล: {item.reason}</div>
        )}
      </div>
    </div>
  );
}

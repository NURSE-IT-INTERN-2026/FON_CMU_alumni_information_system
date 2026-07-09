"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  describeActivityLog,
  describeAuthEvent,
  detailRows,
  readSectionChanges,
  sectionCountSummary,
} from "@/lib/log-detail";

/**
 * Merged change timeline for one alumni — the "data logs" tab on the admin
 * alumni profile page (PRD §3.18). Fed by GET /api/alumni/[id]/activity, which
 * unions per-field change history (alumni core + related rows; orphans only)
 * with activity-log events. Newest first. Clicking a row opens a detail modal.
 * Row titles + modal text come from the shared `lib/log-detail.ts` description
 * layer so this matches the System Logs page word-for-word.
 */

type ActorType = "ADMIN" | "ALUMNI" | "SYSTEM";

// Thai labels for tracked fields (change rows + field-item titles).
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

/** Field changes for an activity item: linked rows, else the `details.changes`
 *  snapshot some routes embed (`{field, from, to}` → normalized). */
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

/** One-line Thai title for a timeline row (list + modal header). */
function itemTitle(item: TimelineItem): string {
  if (item.kind === "field") {
    return `แก้ไข${FIELD_LABELS[item.field] ?? item.field}`;
  }
  return describeActivityLog({
    action: item.action,
    resource: item.resource,
    details: item.details as Record<string, unknown> | null,
  });
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
  const isActivity = item.kind === "activity";
  const details = isActivity ? (item.details as Record<string, unknown> | null) : null;
  const changes: FieldChange[] = isActivity
    ? effectiveChanges(item)
    : [{ field: item.field, oldValue: item.oldValue, newValue: item.newValue }];
  const authLead =
    isActivity && item.resource === "alumni_auth"
      ? describeAuthEvent(item.action, details)
      : null;
  const rows = changes.length === 0 ? detailRows(details) : [];
  const sectionRows = changes.length === 0 && rows.length === 0 ? readSectionChanges(details) : [];
  const countSummary =
    isActivity && changes.length === 0 && rows.length === 0 && sectionRows.length === 0
      ? sectionCountSummary(details)
      : null;

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

        {authLead && (
          <p className="mb-3 rounded-lg border border-[var(--border)] bg-gray-50 p-3 text-sm font-medium text-[var(--foreground)]">
            {authLead}
          </p>
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
        ) : rows.length > 0 ? (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] bg-gray-50 p-3 text-sm">
                <div className="text-xs font-medium text-[var(--muted)]">{r.label}</div>
                <div className="mt-1 text-gray-800">{r.value}</div>
              </div>
            ))}
          </div>
        ) : sectionRows.length > 0 ? (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {sectionRows.map((s, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] bg-gray-50 p-3 text-sm">
                <div className="text-xs font-semibold text-[var(--muted)]">{s.label}</div>
                {s.added.length > 0 && (
                  <div className="mt-1 text-green-700">
                    <span className="text-xs text-[var(--muted)]">เพิ่ม: </span>
                    {s.added.join(", ")}
                  </div>
                )}
                {s.removed.length > 0 && (
                  <div className="mt-1 text-red-600">
                    <span className="text-xs text-[var(--muted)]">ลบ: </span>
                    {s.removed.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : countSummary ? (
          <div className="rounded-lg border border-[var(--border)] bg-gray-50 p-3 text-sm text-gray-800">
            รายการที่บันทึก: {countSummary}
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

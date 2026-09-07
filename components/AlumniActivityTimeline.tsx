"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { Modal } from "@/components/ui/modal";
import {
  describeActivityLog,
  describeAuthEvent,
  detailRows,
  formatValue,
  readSectionChanges,
  sectionCountSummary,
  FIELD_LABELS,
  resourceLabel,
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

interface FieldChange {
  field: string;
  // Kept raw (not pre-stringified) so render can formatValue enums per field.
  oldValue: unknown;
  newValue: unknown;
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
 *  snapshot some routes embed (`{field, from, to}` → normalized). Values are
 *  kept raw so `formatValue` can translate enum values per field. */
function effectiveChanges(item: ActivityItem): FieldChange[] {
  if (item.changes.length > 0) return item.changes;
  const details = item.details as Record<string, unknown> | null;
  const raw = details?.changes;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      field: String(c.field ?? ""),
      oldValue: c.from == null ? null : c.from,
      newValue: c.to == null ? null : c.to,
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
                    ({resourceLabel(item.resourceType)})
                  </span>
                )}
            </div>

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
    <Modal
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={itemTitle(item)}
      size="md"
    >
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
                  <span className="text-gray-400 line-through">{formatValue(c.field, c.oldValue)}</span>
                  <span className="mx-1.5 font-semibold text-orange-500">→</span>
                  <span className="text-gray-800">{formatValue(c.field, c.newValue)}</span>
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
    </Modal>
  );
}

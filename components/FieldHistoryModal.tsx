"use client";

import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/constants";
import { Modal } from "@/components/ui/modal";

interface HistoryEntry {
  oldValue: string | null;
  newValue: string | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}

/**
 * Lists the update history (old → new, date, actor, reason) for a single
 * record field. Opened by clicking an orange updated value (PRD §3.16).
 * Conditionally mounted by the caller (OrangeCell) — internally always `open`,
 * any close path (Escape / overlay / ×) calls `onClose` which unmounts it.
 */
export default function FieldHistoryModal({
  resourceType,
  resourceId,
  field,
  onClose,
}: {
  // One resource type, or several (e.g. ["alumni", "alumni_profile"]) so a
  // field changed under either tracking scope shows a complete history.
  resourceType: string | string[];
  resourceId: string;
  field: string;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const resourceTypeParam = Array.isArray(resourceType)
    ? resourceType.join(",")
    : resourceType;

  useEffect(() => {
    let cancelled = false;
    fetch(
      `${BASE_PATH}/api/field-changes?resourceType=${encodeURIComponent(resourceTypeParam)}&resourceId=${encodeURIComponent(resourceId)}&field=${encodeURIComponent(field)}`
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((d: HistoryEntry[]) => {
        if (!cancelled) setHistory(d);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [resourceTypeParam, resourceId, field]);

  const fmt = (s: string) =>
    new Date(s).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

  return (
    <Modal
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={`ประวัติการแก้ไข: ${field}`}
      size="md"
    >
      {history === null ? (
        <p className="text-sm text-gray-400">กำลังโหลด...</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-gray-400">ไม่มีประวัติ</p>
      ) : (
        <ul className="max-h-96 space-y-3 overflow-y-auto">
          {history.map((h, i) => (
            <li
              key={i}
              className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm"
            >
              <div>
                <span className="text-gray-400 line-through">
                  {h.oldValue || "—"}
                </span>
                <span className="mx-1.5 font-semibold text-orange-500">→</span>
                <span className="text-gray-800">{h.newValue || "—"}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {fmt(h.createdAt)}
                {h.actorName ? ` • ${h.actorName}` : ""}
                {h.reason ? ` • ${h.reason}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

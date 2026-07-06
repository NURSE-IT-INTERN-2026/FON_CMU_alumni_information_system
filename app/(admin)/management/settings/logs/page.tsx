"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { useRole } from "@/lib/role-context";
import { useBulkSelection } from "@/lib/useBulkSelection";
import { BASE_PATH } from "@/lib/constants";
import {
  FIELD_LABELS,
  formatValue,
  detailRows,
  extractChanges,
  extractImportDetails,
  type ImportDetailView,
  type ImportRecordView,
} from "@/lib/log-detail";

interface ActivityLog {
  id: string;
  actorType: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  alumniId: string | null;
  alumniName: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
  } | null;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "เพิ่มข้อมูล",
  LOGIN: "เข้าสู่ระบบ",
  UPDATE: "แก้ไขข้อมูล",
  DELETE: "ลบข้อมูล",
  BULK_DELETE: "ลบหลายรายการ",
  IMPORT: "นำเข้าข้อมูล",
  EXPORT: "ส่งออกข้อมูล",
  SUSPEND: "ระงับบัญชี",
  RESTORE: "ยกเลิกการระงับ",
  HARD_DELETE: "ลบถาวร",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-purple-100 text-purple-700",
  LOGIN: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-yellow-100 text-yellow-700",
  DELETE: "bg-red-100 text-red-700",
  BULK_DELETE: "bg-red-100 text-red-700",
  IMPORT: "bg-purple-100 text-purple-700",
  EXPORT: "bg-indigo-100 text-indigo-700",
  SUSPEND: "bg-amber-100 text-amber-700",
  RESTORE: "bg-green-100 text-green-700",
  HARD_DELETE: "bg-red-100 text-red-700",
};

const RESOURCE_LABELS: Record<string, string> = {
  alumni: "ศิษย์เก่า",
  award: "รางวัล",
  association: "สมาคม/ชมรม",
  graduate_committee: "กรรมการบัณฑิต",
  potential: "ศักยภาพ",
  model_representative: "ผู้แทนรุ่น",
  alumni_agency: "ข้อมูลการทำงานศิษย์เก่า",
  abroad_alumni: "ข้อมูลการทำงานศิษย์เก่า",  // legacy key for pre-rename log rows
  news: "ข่าวสาร",
  user: "ผู้ใช้งาน",
  alumni_profile: "ข้อมูลส่วนตัวศิษย์เก่า",
  education: "ประวัติการศึกษา",
};

const PAGE_SIZE = 20;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [resourceFilter, setResourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [detailLog, setDetailLog] = useState<ActivityLog | null>(null);

  // Log deletion is superadmin-only (irreversible audit changes).
  const canDeleteLogs = useRole() === "superadmin";
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const {
    selectedCount,
    toggleSelect,
    selectAll,
    deselectAll,
    isSelected,
    isAllSelected,
    getSelectedArray,
  } = useBulkSelection();
  const qc = useQueryClient();

  const { data: logsData, isPending: loading, isError } = useQuery({
    queryKey: queryKeys.logs.list({ page, resource: resourceFilter, action: actionFilter, source: sourceFilter }),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (resourceFilter) params.set("resource", resourceFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      return apiFetch<{ data: ActivityLog[]; total: number }>(`/api/logs?${params}`);
    },
  });
  const logs = logsData?.data ?? [];
  const total = logsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageIds = logs.map((l) => l.id);

  const handleFilterChange = () => {
    setPage(1);
  };

  function handleRowClick(id: string) {
    if (!selectionMode) {
      // First click enters selection mode and selects the clicked row.
      setSelectionMode(true);
      toggleSelect(id);
    } else {
      toggleSelect(id);
    }
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    deselectAll();
  }

  async function deleteLogs(ids: string[]) {
    setDeleting(true);
    setErrorMsg("");
    try {
      await apiFetch("/api/logs/bulk-delete", { method: "POST", json: { ids } });
      qc.invalidateQueries({ queryKey: queryKeys.logs.all });
      return true;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบข้อมูล");
      return false;
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkDelete() {
    const ids = getSelectedArray();
    if (ids.length === 0) return;
    if (await deleteLogs(ids)) {
      exitSelectionMode();
      setShowBulkDeleteDialog(false);
      setPage(1);
    }
  }

  async function handleDeleteOne(id: string) {
    if (await deleteLogs([id])) {
      setDetailLog(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          บันทึกกิจกรรม
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">ทั้งหมด {total.toLocaleString()} รายการ</span>
          {canDeleteLogs && !selectionMode && (
            <button
              onClick={() => setSelectionMode(true)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer"
            >
              เลือกเพื่อลบ
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); handleFilterChange(); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="">ทุกแหล่งที่มา</option>
          <option value="admin">ผู้ดูแลระบบ</option>
          <option value="alumni">ศิษย์เก่า</option>
          <option value="system">ระบบ</option>
        </select>

        <select
          value={resourceFilter}
          onChange={(e) => { setResourceFilter(e.target.value); handleFilterChange(); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="">ทุกประเภทข้อมูล</option>
          {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); handleFilterChange(); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="">ทุกกิจกรรม</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{errorMsg}</div>
      )}

      {/* Selection toolbar */}
      {selectionMode && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5">
          <span className="text-sm font-medium text-purple-800">
            เลือกแล้ว <span className="font-bold">{selectedCount}</span> รายการ
          </span>
          <button
            onClick={() => (isAllSelected(pageIds) ? deselectAll() : selectAll(pageIds))}
            disabled={logs.length === 0}
            className="rounded-lg border border-purple-300 bg-white px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-40 cursor-pointer"
          >
            {isAllSelected(pageIds) ? "ยกเลิกเลือกหน้านี้" : "เลือกทั้งหน้า"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={exitSelectionMode}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => setShowBulkDeleteDialog(true)}
              disabled={selectedCount === 0}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 cursor-pointer"
            >
              ลบที่เลือก ({selectedCount})
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">กำลังโหลด...</div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400">ไม่มีข้อมูลบันทึกกิจกรรม</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {selectionMode && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isAllSelected(pageIds)}
                      onChange={() => (isAllSelected(pageIds) ? deselectAll() : selectAll(pageIds))}
                      className="h-4 w-4 cursor-pointer accent-purple-600"
                    />
                  </th>
                )}
                <th className="px-4 py-3">วันที่/เวลา</th>
                <th className="px-4 py-3">ผู้ใช้งาน</th>
                <th className="px-4 py-3">กิจกรรม</th>
                <th className="px-4 py-3">ประเภทข้อมูล</th>
                <th className="px-4 py-3">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => {
                const isSystemActor = log.actorType === "SYSTEM";
                const isAlumniActor = log.actorType === "ALUMNI";
                const actorName = isSystemActor
                  ? "ระบบ"
                  : isAlumniActor
                    ? (log.alumniName || "—")
                    : (log.user ? `${log.user.firstName} ${log.user.lastName}` : "—");
                const actorSub = isSystemActor
                  ? ""
                  : isAlumniActor
                    ? ""
                    : (log.userEmail || "");
                const selected = isSelected(log.id);

                return (
                  <tr
                    key={log.id}
                    onClick={canDeleteLogs ? () => handleRowClick(log.id) : undefined}
                    className={`${selected ? "bg-purple-50" : ""} ${canDeleteLogs ? "cursor-pointer" : ""} hover:bg-gray-50`}
                  >
                    {selectionMode && (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(log.id)}
                          className="h-4 w-4 cursor-pointer accent-purple-600"
                        />
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{actorName}</div>
                      <div className="flex items-center gap-1.5">
                        {isSystemActor && (
                          <span className="inline-block rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">ระบบ</span>
                        )}
                        {isAlumniActor && (
                          <span className="inline-block rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">ศิษย์เก่า</span>
                        )}
                        {actorSub && (
                          <span className="text-xs text-gray-400">{actorSub}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{RESOURCE_LABELS[log.resource] || log.resource}</td>
                    <td className="px-4 py-3">
                      {log.action === "IMPORT" ? (
                        <ImportRowSummary
                          details={log.details}
                          onOpen={() => setDetailLog(log)}
                        />
                      ) : (
                        <div className="flex justify-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailLog(log); }}
                            className="cursor-pointer rounded p-1 text-purple-600 hover:bg-purple-100"
                            title="ดูรายละเอียด"
                            aria-label="ดูรายละเอียด"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-gray-500">หน้า {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">ก่อนหน้า</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">ถัดไป</button>
          </div>
        </div>
      )}

      {/* Details modal */}
      {detailLog && (
        <DetailModal
          log={detailLog}
          canDelete={canDeleteLogs}
          deleting={deleting}
          onClose={() => setDetailLog(null)}
          onDelete={handleDeleteOne}
        />
      )}

      {/* Bulk-delete confirmation */}
      {showBulkDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !deleting && setShowBulkDeleteDialog(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการลบบันทึกกิจกรรม</h3>
            <p className="mb-6 text-sm text-gray-600">
              คุณต้องการลบบันทึกกิจกรรม <span className="font-bold text-red-600">{selectedCount}</span> รายการหรือไม่?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBulkDeleteDialog(false)} disabled={deleting} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 cursor-pointer">ยกเลิก</button>
              <button onClick={handleBulkDelete} disabled={deleting} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 cursor-pointer">
                {deleting ? "กำลังลบ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail modal — one shape per action (create / edit / delete)               */
/* -------------------------------------------------------------------------- */

function DetailModal({
  log,
  canDelete,
  deleting,
  onClose,
  onDelete,
}: {
  log: ActivityLog;
  canDelete: boolean;
  deleting: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const changes = extractChanges(log.details);
  const rows = detailRows(log.details);
  const importDetails = extractImportDetails(log.details);
  const resourceLabel = RESOURCE_LABELS[log.resource] ?? log.resource;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"}`}>
                {ACTION_LABELS[log.action] || log.action}
              </span>
              {resourceLabel}
            </h3>
            <p className="mt-1 text-sm text-gray-500">{formatDate(log.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        {/* Body — tailored to the action */}
        <div className="mb-3">
          {log.action === "IMPORT" && importDetails ? (
            <ImportDetail details={importDetails} />
          ) : log.action === "UPDATE" && changes && changes.length > 0 ? (
            <EditDiff changes={changes} />
          ) : log.action === "UPDATE" ? (
            <DataCard title="ข้อมูลหลังแก้ไข" rows={rows} emptyText="ไม่มีการเปลี่ยนแปลงค่า" />
          ) : log.action === "CREATE" ? (
            <DataCard title="ข้อมูลที่เพิ่ม" rows={rows} emptyText="ไม่มีข้อมูลที่บันทึกไว้" />
          ) : log.action === "DELETE" || log.action === "HARD_DELETE" ? (
            <DataCard title="ข้อมูลที่ลบ" rows={rows} emptyText={`ไม่มีข้อมูลที่บันทึกไว้ (รหัส ${log.resourceId ?? "—"})`} />
          ) : (
            <DataCard title="รายละเอียด" rows={rows} emptyText="ไม่มีรายละเอียด" />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
          {log.reason ? (
            <p className="text-xs text-gray-500">หมายเหตุ: {log.reason}</p>
          ) : <span />}
          {canDelete && (
            <button
              onClick={() => onDelete(log.id)}
              disabled={deleting}
              className="shrink-0 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 cursor-pointer"
            >
              {deleting ? "กำลังลบ..." : "ลบรายการนี้"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A single labeled-field card. */
function DataCard({ title, rows, emptyText }: { title: string; rows: { label: string; value: string }[]; emptyText: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <p className="mb-3 text-sm font-semibold text-gray-700">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <dt className="min-w-[7rem] shrink-0 text-gray-500">{r.label}</dt>
              <dd className="break-words font-medium text-gray-800">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Two cards: old (left) → new (right), one row per changed field. */
function EditDiff({ changes }: { changes: { field: string; from: string | null; to: string | null }[] }) {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        <p className="mb-3 text-sm font-semibold text-gray-500">ก่อนแก้ไข</p>
        <dl className="space-y-2">
          {changes.map((c, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <dt className="min-w-[7rem] shrink-0 text-gray-500">{FIELD_LABELS[c.field] ?? c.field}</dt>
              <dd className="break-words text-gray-400 line-through">{formatValue(c.field, c.from) || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex items-center justify-center text-orange-500" aria-hidden>
        <svg className="hidden h-6 w-6 sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" /></svg>
        <svg className="h-6 w-6 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 13l5 5 5-5M12 6v12" /></svg>
      </div>

      <div className="flex-1 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
        <p className="mb-3 text-sm font-semibold text-orange-600">หลังแก้ไข</p>
        <dl className="space-y-2">
          {changes.map((c, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <dt className="min-w-[7rem] shrink-0 text-orange-400">{FIELD_LABELS[c.field] ?? c.field}</dt>
              <dd className="break-words font-medium text-gray-900">{formatValue(c.field, c.to) || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Import log — inline row summary + dedicated detail view                     */
/* -------------------------------------------------------------------------- */

type BadgeTone = "green" | "blue" | "red" | "purple" | "gray";

const BADGE_TONES: Record<BadgeTone, string> = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
  gray: "bg-gray-100 text-gray-600",
};

function CountBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Compact created/updated/failed badges shown inline on an IMPORT table row. */
function ImportRowSummary({ details, onOpen }: { details: Record<string, unknown> | null; onOpen: () => void }) {
  const d = extractImportDetails(details);
  // Legacy number-only alumni imports aren't import-shaped — fall back to the eye icon.
  if (!d) {
    return (
      <div className="flex justify-center">
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="cursor-pointer rounded p-1 text-purple-600 hover:bg-purple-100"
          title="ดูรายละเอียด" aria-label="ดูรายละเอียด"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </div>
    );
  }

  const legacy = d.created === 0 && d.updated === 0 && d.imported > 0;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className="flex flex-wrap items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-purple-50 cursor-pointer"
      title="ดูรายการที่นำเข้า"
    >
      {legacy ? (
        <CountBadge tone="purple">นำเข้า {d.imported}</CountBadge>
      ) : (
        <>
          {d.created > 0 && <CountBadge tone="green">สร้าง {d.created}</CountBadge>}
          {d.updated > 0 && <CountBadge tone="blue">อัปเดต {d.updated}</CountBadge>}
          {d.created === 0 && d.updated === 0 && <CountBadge tone="gray">ไม่มีรายการ</CountBadge>}
        </>
      )}
      {d.failed > 0 && <CountBadge tone="red">ผิดพลาด {d.failed}</CountBadge>}
      <span className="ml-0.5 inline-flex items-center text-[11px] font-medium text-purple-600">
        ดูรายการ
        <svg className="ml-0.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </span>
    </button>
  );
}

/** A single imported record — links to the alumni profile when it has a studentId. */
function ImportRecordRow({ record }: { record: ImportRecordView }) {
  const opBadge =
    record.op === "created" ? <CountBadge tone="green">สร้าง</CountBadge> : <CountBadge tone="blue">อัปเดต</CountBadge>;
  const content = (
    <span className="flex min-w-0 items-center gap-2">
      {opBadge}
      <span className="truncate font-medium text-gray-800">{record.name || "—"}</span>
      {record.id && <span className="shrink-0 text-xs text-gray-400">{record.id}</span>}
    </span>
  );
  if (record.id) {
    return (
      <li className="hover:bg-purple-50/60">
        <a
          href={`${BASE_PATH}/management/alumni/${record.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 px-3 py-2"
        >
          {content}
          <svg className="h-4 w-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5M19 5l-9 9M19 13v5a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1h5" /></svg>
        </a>
      </li>
    );
  }
  return <li className="px-3 py-2">{content}</li>;
}

/** Full import detail view: summary header + searchable record list + failed rows. */
function ImportDetail({ details }: { details: ImportDetailView }) {
  const [query, setQuery] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const legacy = details.created === 0 && details.updated === 0 && details.imported > 0;
  const q = query.trim().toLowerCase();
  const filtered =
    q && details.records.length > 0
      ? details.records.filter(
          (r) => r.name.toLowerCase().includes(q) || (r.id ?? "").toLowerCase().includes(q)
        )
      : details.records;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        {details.fileName && (
          <p className="mb-2 text-sm text-gray-500">
            ไฟล์: <span className="font-medium text-gray-700">{details.fileName}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {legacy ? (
            <CountBadge tone="purple">นำเข้า {details.imported}</CountBadge>
          ) : (
            <>
              <CountBadge tone="green">สร้างใหม่ {details.created}</CountBadge>
              <CountBadge tone="blue">อัปเดต {details.updated}</CountBadge>
            </>
          )}
          {details.failed > 0 && <CountBadge tone="red">ผิดพลาด {details.failed}</CountBadge>}
          <span className="text-xs text-gray-400">นำเข้าทั้งหมด {details.attempted} แถว</span>
        </div>
      </div>

      {/* Record list */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-700">รายการที่นำเข้า</p>
          {details.records.length > 0 && (
            <div className="relative">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหา ชื่อ / รหัสนักศึกษา"
                className="w-60 rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
          )}
        </div>

        {details.truncated && (
          <p className="mb-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            แสดง {details.records.length.toLocaleString()} จาก {details.totalRecords.toLocaleString()} รายการ (ข้อมูลมากเกินกว่าจะบันทึกไว้ทั้งหมดในบันทึกกิจกรรม)
          </p>
        )}

        {details.records.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-400">ไม่มีรายการที่บันทึกไว้</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-400">ไม่พบรายการที่ตรงกับ &ldquo;{query}&rdquo;</p>
        ) : (
          <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
            {filtered.map((r, i) => (
              <ImportRecordRow key={`${r.id ?? "noid"}-${i}`} record={r} />
            ))}
          </ul>
        )}
      </div>

      {/* Failed rows */}
      {details.errors.length > 0 && (
        <div>
          <button
            onClick={() => setShowErrors((s) => !s)}
            className="flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700 cursor-pointer"
          >
            <svg className={`h-4 w-4 transition-transform ${showErrors ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            รายการที่ผิดพลาด ({details.totalErrors})
          </button>
          {details.errorsTruncated && (
            <p className="mt-1 ml-5 text-xs text-amber-700">แสดง {details.errors.length} จาก {details.totalErrors} รายการ</p>
          )}
          {showErrors && (
            <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-red-100 bg-red-50/40 p-3 text-sm">
              {details.errors.map((e, i) => (
                <li key={i} className="text-red-700">
                  <span className="font-medium">แถว {e.row > 0 ? e.row : "—"}:</span> {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

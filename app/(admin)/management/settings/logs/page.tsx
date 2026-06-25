"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import {
  FIELD_LABELS,
  formatValue,
  detailRows,
  extractChanges,
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
  alumni_agency: "ต้นสังกัดศิษย์เก่า",
  abroad_alumni: "ต้นสังกัดศิษย์เก่า",  // legacy key for pre-rename log rows
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

  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          บันทึกกิจกรรม
        </h1>
        <span className="text-sm text-gray-500">ทั้งหมด {total.toLocaleString()} รายการ</span>
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

                return (
                  <tr key={log.id} className="hover:bg-gray-50">
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
                      <div className="flex justify-center">
                        <button onClick={() => setDetailLog(log)} className="cursor-pointer rounded p-1 text-purple-600 hover:bg-purple-100" title="ดูรายละเอียด" aria-label="ดูรายละเอียด">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                      </div>
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
        <DetailModal log={detailLog} onClose={() => setDetailLog(null)} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail modal — one shape per action (create / edit / delete)               */
/* -------------------------------------------------------------------------- */

function DetailModal({ log, onClose }: { log: ActivityLog; onClose: () => void }) {
  const changes = extractChanges(log.details);
  const rows = detailRows(log.details);
  const resourceLabel = RESOURCE_LABELS[log.resource] ?? log.resource;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl"
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
          {log.action === "UPDATE" && changes && changes.length > 0 ? (
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

        {log.reason && (
          <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">หมายเหตุ: {log.reason}</p>
        )}
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

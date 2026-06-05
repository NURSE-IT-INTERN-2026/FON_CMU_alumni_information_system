"use client";

import { useEffect, useState, useCallback } from "react";
import { useRole } from "@/lib/role-context";
import { useRouter } from "next/navigation";

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
  ipAddress: string | null;
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
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-blue-100 text-blue-700",
  UPDATE: "bg-yellow-100 text-yellow-700",
  DELETE: "bg-red-100 text-red-700",
  BULK_DELETE: "bg-red-100 text-red-700",
  IMPORT: "bg-purple-100 text-purple-700",
  EXPORT: "bg-indigo-100 text-indigo-700",
};

const RESOURCE_LABELS: Record<string, string> = {
  alumni: "ศิษย์เก่า",
  award: "รางวัล",
  association: "สมาคม/ชมรม",
  graduate_committee: "กรรมการบัณฑิต",
  potential: "ศักยภาพ",
  model_representative: "ผู้แทนรุ่น",
  abroad_alumni: "การทำงานต่างประเทศ",
  news: "ข่าวสาร",
  user: "ผู้ใช้งาน",
  alumni_profile: "ข้อมูลส่วนตัวศิษย์เก่า",
};

const PAGE_SIZE = 20;

export default function LogsPage() {
  const role = useRole();
  const router = useRouter();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [resourceFilter, setResourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (role === "executive") {
      router.replace("/");
    }
  }, [role, router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (resourceFilter) params.set("resource", resourceFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (sourceFilter) params.set("source", sourceFilter);

      const res = await fetch(`/api/logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setLogs(data.data);
      setTotal(data.total);
      setTotalPages(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
    } catch {
      setErrorMsg("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [page, resourceFilter, actionFilter, sourceFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = () => {
    setPage(1);
  };

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

  function formatDetails(details: Record<string, unknown> | null): string {
    if (!details) return "-";
    return Object.entries(details)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }

  if (role === "executive") return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          บันทึกกิจกรรม
        </h1>
        <span className="text-sm text-gray-500">ทั้งหมด {total.toLocaleString()} รายการ</span>
      </div>

      {errorMsg && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-4 font-bold text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

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
                <th className="px-4 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => {
                const isAlumniActor = log.actorType === "ALUMNI";
                const actorName = isAlumniActor
                  ? (log.alumniName || "ศิษย์เก่า")
                  : (log.user ? `${log.user.firstName} ${log.user.lastName}` : "—");
                const actorSub = isAlumniActor
                  ? "ศิษย์เก่า"
                  : (log.userEmail || "");

                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{actorName}</div>
                      <div className="flex items-center gap-1.5">
                        {isAlumniActor && (
                          <span className="inline-block rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">ศิษย์เก่า</span>
                        )}
                        <span className="text-xs text-gray-400">{actorSub}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{RESOURCE_LABELS[log.resource] || log.resource}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-500">{formatDetails(log.details)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-400">{log.ipAddress || "-"}</td>
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
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { BASE_PATH } from "@/lib/constants";
import { useRole } from "@/lib/role-context";

interface TrashRecord {
  id: string;
  deletedAt: string | null;
  displayName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot: any;
}

interface ApiResponse {
  data: TrashRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  entity: string;
  label: string;
}

const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: "alumni", label: "ข้อมูลนักศึกษาเก่า" },
  { value: "awards", label: "รางวัล" },
  { value: "potentials", label: "ศักยภาพ" },
  { value: "associations", label: "สมาคม/ชมรม" },
  { value: "graduate-committee", label: "กรรมการบัณฑิต" },
  { value: "model-representatives", label: "ผู้แทนรุ่น" },
  { value: "alumni-agency", label: "ต้นสังกัดศิษย์เก่า" },
];

export default function TrashPage() {
  const role = useRole();
  const isSuperAdmin = role === "superadmin";

  const [entity, setEntity] = useState("alumni");
  const [records, setRecords] = useState<TrashRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams({ entity, page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${BASE_PATH}/api/trash?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setRecords(data.data);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoading(false);
    }
  }, [entity, page, search]);

  useEffect(() => {
    if (isSuperAdmin) fetchTrash();
  }, [fetchTrash, isSuperAdmin]);

  const restore = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${BASE_PATH}/api/trash/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "เกิดข้อผิดพลาด");
      }
      setActionId(null);
      fetchTrash();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusyId(null);
    }
  };

  const hardDelete = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${BASE_PATH}/api/trash/hard-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id, confirm: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "เกิดข้อผิดพลาด");
      }
      setHardDeleteId(null);
      setHardDeleteConfirm(null);
      fetchTrash();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusyId(null);
    }
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString("th-TH");
    } catch {
      return iso;
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-2xl font-bold text-[var(--primary)]">รายการที่ถูกลบ</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้ ต้องเป็นผู้ดูแลระบบขั้นสูงเท่านั้น
        </div>
      </div>
    );
  }

  const pageStart = total === 0 ? 0 : (page - 1) * 10 + 1;
  const pageEnd = Math.min(page * 10, total);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">รายการที่ถูกลบ</h1>
        <p className="mt-1 text-sm text-gray-500">
          รายการที่ถูกลบชั่วคราว สามารถกู้คืน หรือลบถาวรได้ (ผู้ดูแลระบบขั้นสูงเท่านั้น)
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-4 text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {/* Entity selector + search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={entity}
          onChange={(e) => { setEntity(e.target.value); setPage(1); }}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-white focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        >
          {ENTITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="ค้นหา..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] sm:max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-[var(--muted)]">ไม่พบรายการที่ถูกลบ</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--primary)] text-white">
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">ลำดับ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">ชื่อรายการ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">วันที่ลบ</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r, i) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-center text-gray-500">{(page - 1) * 10 + i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.displayName}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(r.deletedAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {actionId === r.id ? (
                        <>
                          <button
                            onClick={() => restore(r.id)}
                            disabled={busyId === r.id}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {busyId === r.id ? "..." : "ยืนยันกู้คืน"}
                          </button>
                          <button onClick={() => setActionId(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">ยกเลิก</button>
                        </>
                      ) : hardDeleteId === r.id ? (
                        <>
                          <button
                            onClick={() => setHardDeleteConfirm(r.id)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                          >
                            ลบถาวร
                          </button>
                          <button onClick={() => setHardDeleteId(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">ยกเลิก</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setActionId(r.id)} className="rounded-lg border border-green-600 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-600 hover:text-white transition-colors">กู้คืน</button>
                          <button onClick={() => setHardDeleteId(r.id)} className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500 hover:text-white transition-colors">ลบถาวร</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
            <span className="text-sm text-gray-500">แสดง {pageStart}-{pageEnd} จาก {total} รายการ</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">ก่อนหน้า</button>
              <span className="px-3 text-sm text-gray-600">หน้า {page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">ถัดไป</button>
            </div>
          </div>
        </div>
      )}

      {/* Final hard-delete confirmation (second confirmation step) */}
      {hardDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-red-700">ยืนยันการลบถาวร</h3>
            <p className="mb-6 text-sm text-gray-600">
              การลบถาวรจะไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้ออกจากระบบอย่างถาวร?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setHardDeleteConfirm(null); setHardDeleteId(null); }} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={() => hardDelete(hardDeleteConfirm)} disabled={busyId === hardDeleteConfirm} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {busyId === hardDeleteConfirm ? "กำลังลบ..." : "ลบถาวร"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

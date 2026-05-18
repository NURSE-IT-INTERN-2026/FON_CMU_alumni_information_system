"use client";

import { useEffect, useState, useCallback } from "react";
import { PAGE_SIZE } from "@/lib/constants";

interface Committee {
  id: string;
  termYear: number;
  studentId: string;
  fullName: string;
  cohort: string;
  position: string;
  remarks: string | null;
}

interface ApiResponse {
  data: Committee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type SortField = "termYear" | "studentId" | "fullName" | "cohort" | "position" | "remarks";
type SortDir = "asc" | "desc";
type SearchField = "studentId" | "fullName" | "cohort" | "position" | "remarks" | "termYear";

const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
  { value: "studentId", label: "รหัสนักศึกษา" },
  { value: "fullName", label: "ชื่อ-สกุล" },
  { value: "cohort", label: "รุ่นที่" },
  { value: "position", label: "ตำแหน่ง" },
  { value: "remarks", label: "หมายเหตุ" },
  { value: "termYear", label: "ปี พ.ศ." },
];

const EMPTY_FORM = { termYear: "", studentId: "", fullName: "", cohort: "", position: "", remarks: "" };

export default function GraduateCommitteePage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("studentId");
  const [filterCohort, setFilterCohort] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [cohortOptions, setCohortOptions] = useState<string[]>([]);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("termYear");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [manageMode, setManageMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/graduate-committee?pageSize=9999");
      if (!res.ok) return;
      const json = await res.json();
      const all: Committee[] = json.data;
      setCohortOptions([...new Set(all.map((c) => c.cohort).filter(Boolean))].sort());
      setPositionOptions([...new Set(all.map((c) => c.position).filter(Boolean))].sort());
    } catch {}
  }, []);

  useEffect(() => { fetchFilterOptions(); }, [fetchFilterOptions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const fetchCommittees = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy: sortField,
        sortOrder: sortDir,
      });
      if (search) params.set("search", search);
      params.set("searchField", searchField);
      if (filterCohort) params.set("cohort", filterCohort);
      if (filterPosition) params.set("position", filterPosition);

      const res = await fetch(`/api/graduate-committee?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setCommittees(data.data);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, searchField, filterCohort, filterPosition, sortField, sortDir]);

  useEffect(() => { fetchCommittees(); }, [fetchCommittees]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (c: Committee) => {
    setForm({
      termYear: String(c.termYear),
      studentId: c.studentId,
      fullName: c.fullName,
      cohort: c.cohort,
      position: c.position,
      remarks: c.remarks || "",
    });
    setFormErrors({});
    setEditingId(c.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.termYear.trim()) errors.termYear = "กรุณากรอกปี พ.ศ.";
    if (form.termYear && isNaN(Number(form.termYear))) errors.termYear = "ปี พ.ศ. ต้องเป็นตัวเลข";
    if (!form.studentId.trim()) errors.studentId = "กรุณากรอกรหัสนักศึกษา";
    if (!form.fullName.trim()) errors.fullName = "กรุณากรอกชื่อ-สกุล";
    if (!form.cohort.trim()) errors.cohort = "กรุณากรอกรุ่นที่";
    if (!form.position.trim()) errors.position = "กรุณากรอกตำแหน่ง";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const payload = { ...form, termYear: Number(form.termYear) };
      const res = editingId
        ? await fetch(`/api/graduate-committee/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/graduate-committee", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }
      closeForm();
      fetchCommittees();
      fetchFilterOptions();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/graduate-committee/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchCommittees();
      fetchFilterOptions();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  const paginationNumbers = (() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  })();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">กรรมการบัณฑิต</h1>
        {!manageMode ? (
          <button onClick={() => setManageMode(true)} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            จัดการข้อมูล
          </button>
        ) : (
          <button onClick={() => { setManageMode(false); setShowForm(false); }} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50">
            กลับหน้าเดิม
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-4 text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {manageMode && showForm && (
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">
            {editingId ? "แก้ไขข้อมูลกรรมการบัณฑิต" : "เพิ่มข้อมูลกรรมการบัณฑิต"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ปี พ.ศ. *</label>
              <input type="number" value={form.termYear} onChange={(e) => setForm((f) => ({ ...f, termYear: e.target.value }))} placeholder="เช่น 2568" className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.termYear ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.termYear && <p className="mt-1 text-xs text-red-500">{formErrors.termYear}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">รหัสนักศึกษา *</label>
              <input type="text" value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.studentId ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.studentId && <p className="mt-1 text-xs text-red-500">{formErrors.studentId}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อ-สกุล (ขณะกำลังศึกษา) *</label>
              <input type="text" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.fullName ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.fullName && <p className="mt-1 text-xs text-red-500">{formErrors.fullName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">รุ่นที่ *</label>
              <input type="text" value={form.cohort} onChange={(e) => setForm((f) => ({ ...f, cohort: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.cohort ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.cohort && <p className="mt-1 text-xs text-red-500">{formErrors.cohort}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ตำแหน่ง *</label>
              <input type="text" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.position ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.position && <p className="mt-1 text-xs text-red-500">{formErrors.position}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">หมายเหตุ</label>
              <input type="text" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={closeForm} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {manageMode && (
        <div className="mb-4">
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            เพิ่มข้อมูล
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <select
          value={searchField}
          onChange={(e) => { setSearchField(e.target.value as SearchField); setSearch(""); setPage(1); }}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-white focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        >
          {SEARCH_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder={`ค้นหา${SEARCH_FIELDS.find((f) => f.value === searchField)?.label}...`}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : committees.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-[var(--muted)]">ไม่พบข้อมูล</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white text-left" style={{ backgroundColor: "#1e3a5f" }}>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("termYear")}>
                    ปี พ.ศ. {sortField === "termYear" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("studentId")}>
                    รหัสนักศึกษา {sortField === "studentId" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("fullName")}>
                    ชื่อ-สกุล {sortField === "fullName" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("cohort")}>
                    รุ่นที่ {sortField === "cohort" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("position")}>
                    ตำแหน่ง {sortField === "position" && (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                    หมายเหตุ
                  </th>
                  {manageMode && (
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">จัดการ</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {committees.map((c, i) => (
                  <tr key={c.id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 text-center">{c.termYear}</td>
                    <td className="px-4 py-3 font-mono">{c.studentId}</td>
                    <td className="px-4 py-3">{c.fullName}</td>
                    <td className="px-4 py-3 text-center">{c.cohort}</td>
                    <td className="px-4 py-3">{c.position}</td>
                    <td className="px-4 py-3 text-gray-500">{c.remarks || "-"}</td>
                    {manageMode && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(c)} className="rounded p-1.5 text-blue-600 hover:bg-blue-100" title="แก้ไข">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                          </button>
                          <button onClick={() => setDeleteId(c.id)} className="rounded p-1.5 text-red-500 hover:bg-red-100" title="ลบ">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {manageMode ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
              <span className="text-sm text-gray-500">แสดง {pageStart}-{pageEnd} จาก {total} รายการ</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">ก่อนหน้า</button>
                {paginationNumbers.map((p, i) =>
                  p === "..." ? <span key={`dot-${i}`} className="px-2 text-gray-400">...</span> : (
                    <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${page === p ? "bg-[var(--primary)] text-white" : "text-gray-600 hover:bg-gray-50"}`}>{p}</button>
                  )
                )}
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">ถัดไป</button>
              </div>
            </div>
          ) : totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50">ก่อนหน้า</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`rounded-md px-3 py-1.5 text-sm ${p === page ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] hover:bg-gray-50"}`}>{p}</button>
              ))}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50">ถัดไป</button>
            </div>
          )}
        </div>
      )}

      {!manageMode && totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50">ก่อนหน้า</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`rounded-md px-3 py-1.5 text-sm ${p === page ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] hover:bg-gray-50"}`}>{p}</button>
          ))}
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50">ถัดไป</button>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการลบข้อมูล</h3>
            <p className="mb-6 text-sm text-gray-600">คุณต้องการลบข้อมูลกรรมการบัณฑิตนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={confirmDelete} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

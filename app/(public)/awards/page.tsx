"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AWARD_TYPE_LABELS, AWARD_TYPE_OPTIONS, PAGE_SIZE } from "@/lib/constants";

interface Award {
  id: string;
  studentId: string;
  awardName: string;
  awardType: string;
  year: number;
  description: string | null;
  alumni: {
    prefix: string;
    firstName: string;
    maidenLastName: string;
  };
}

interface ApiResponse {
  data: Award[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const AWARD_COLORS: Record<string, string> = {
  INTERNATIONAL: "#1e3a5f",
  NATIONAL: "#e8a838",
  LOCAL: "#38a169",
};

type SortField = "name" | "award" | "type" | "year";
type SortDir = "asc" | "desc";

const EMPTY_FORM = { studentId: "", awardName: "", awardType: "INTERNATIONAL", year: "", description: "" };

const alumniDisplayName = (a: { prefix: string; firstName: string; maidenLastName: string }) =>
  `${a.prefix}${a.firstName} ${a.maidenLastName}`;

export default function AwardsPage() {
  const router = useRouter();
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [awardTypeFilter, setAwardTypeFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});

  const [manageMode, setManageMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Alumni search for form
  const [alumniSearch, setAlumniSearch] = useState("");
  const [alumniResults, setAlumniResults] = useState<{ id: string; studentId: string; prefix: string; firstName: string; maidenLastName: string }[]>([]);
  const [showAlumniDropdown, setShowAlumniDropdown] = useState(false);

  const fetchAwards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
        awardType: awardTypeFilter,
      });
      const res = await fetch(`/api/awards?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setAwards(data.data);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, awardTypeFilter]);

  const fetchTypeCounts = useCallback(async () => {
    try {
      const [international, national, local] = await Promise.all([
        fetch("/api/awards?pageSize=1&awardType=INTERNATIONAL").then((r) => r.json()),
        fetch("/api/awards?pageSize=1&awardType=NATIONAL").then((r) => r.json()),
        fetch("/api/awards?pageSize=1&awardType=LOCAL").then((r) => r.json()),
      ]);
      setTypeCounts({ INTERNATIONAL: international.total, NATIONAL: national.total, LOCAL: local.total });
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { fetchTypeCounts(); }, [fetchTypeCounts]);
  useEffect(() => { fetchAwards(); }, [fetchAwards]);

  const handleSearch = (value: string) => { setSearch(value); setPage(1); };
  const handleFilter = (value: string) => { setAwardTypeFilter(value); setPage(1); };

  const handleSort = (field: SortField) => {
    if (sortField === field) { setSortDir(sortDir === "asc" ? "desc" : "asc"); }
    else { setSortField(field); setSortDir("asc"); }
  };

  const sortedAwards = [...awards].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name": cmp = alumniDisplayName(a.alumni).localeCompare(alumniDisplayName(b.alumni)); break;
      case "award": cmp = a.awardName.localeCompare(b.awardName); break;
      case "type": cmp = a.awardType.localeCompare(b.awardType); break;
      case "year": cmp = a.year - b.year; break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 inline-block">{sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▽"}</span>
  );

  const chartData = Object.entries(typeCounts).map(([key, value]) => ({
    name: AWARD_TYPE_LABELS[key] || key,
    value,
    color: AWARD_COLORS[key] || "#999",
  }));

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

  // Alumni search for form
  const searchAlumni = useCallback(async (term: string) => {
    if (term.length < 2) { setAlumniResults([]); return; }
    try {
      const res = await fetch(`/api/alumni?search=${encodeURIComponent(term)}&pageSize=10`);
      if (!res.ok) return;
      const data = await res.json();
      setAlumniResults(data.data || []);
      setShowAlumniDropdown(true);
    } catch {}
  }, []);

  const selectAlumni = (a: { id: string; studentId: string; prefix: string; firstName: string; maidenLastName: string }) => {
    setForm((f) => ({ ...f, studentId: a.studentId }));
    setAlumniSearch(`${a.studentId} - ${alumniDisplayName(a)}`);
    setShowAlumniDropdown(false);
    setAlumniResults([]);
  };

  const openEdit = (a: Award) => {
    setForm({
      studentId: a.studentId,
      awardName: a.awardName,
      awardType: a.awardType,
      year: String(a.year),
      description: a.description || "",
    });
    setAlumniSearch(`${a.studentId} - ${alumniDisplayName(a.alumni)}`);
    setFormErrors({});
    setEditingId(a.id);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAlumniSearch("");
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.studentId) errors.studentId = "กรุณาเลือกศิษย์เก่า";
    if (!form.awardName.trim()) errors.awardName = "กรุณากรอกชื่อรางวัล";
    if (!form.awardType) errors.awardType = "กรุณาเลือกประเภท";
    if (!form.year) errors.year = "กรุณากรอกปี";
    if (form.year && isNaN(Number(form.year))) errors.year = "ปีต้องเป็นตัวเลข";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const payload = {
        studentId: form.studentId,
        awardName: form.awardName.trim(),
        awardType: form.awardType,
        year: Number(form.year),
        description: form.description.trim() || null,
      };
      const res = await fetch(`/api/awards/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }
      closeForm();
      fetchAwards();
      fetchTypeCounts();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/awards/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchAwards();
      fetchTypeCounts();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const handleExport = () => {
    window.location.href = "/api/awards/export";
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/awards/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      setImportResult(data);
      fetchAwards();
      fetchTypeCounts();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้า");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">รางวัลที่ได้รับ</h1>
        {!manageMode ? (
          <button onClick={() => setManageMode(true)} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            จัดการข้อมูล
          </button>
        ) : (
          <button onClick={() => { setManageMode(false); closeForm(); }} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50">
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

      {importResult && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <div className="flex items-center justify-between">
            <span>นำเข้าสำเร็จ {importResult.imported} รายการ{importResult.skipped > 0 && ` (ข้าม ${importResult.skipped} รายการ)`}</span>
            <button onClick={() => setImportResult(null)} className="ml-4 text-green-500 hover:text-green-700 font-bold">&times;</button>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-2 border-t border-green-200 pt-2">
              <p className="font-medium">ข้อผิดพลาด ({importResult.errors.length} รายการ):</p>
              <ul className="mt-1 list-disc pl-4 text-xs">
                {importResult.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>แถวที่ {err.row}: {err.message}</li>
                ))}
                {importResult.errors.length > 10 && <li>...และอีก {importResult.errors.length - 10} รายการ</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {manageMode && editingId && (
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">
            แก้ไขข้อมูลรางวัล
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-gray-700">ศิษย์เก่า *</label>
              <input type="text" value={alumniSearch} onChange={(e) => { setAlumniSearch(e.target.value); searchAlumni(e.target.value); }} placeholder="ค้นหารหัสนักศึกษาหรือชื่อ..." className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.studentId ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.studentId && <p className="mt-1 text-xs text-red-500">{formErrors.studentId}</p>}
              {showAlumniDropdown && alumniResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {alumniResults.map((a) => (
                    <button key={a.id} type="button" onClick={() => selectAlumni(a)} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors">
                      {a.studentId} - {alumniDisplayName(a)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อรางวัล *</label>
              <input type="text" value={form.awardName} onChange={(e) => setForm((f) => ({ ...f, awardName: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.awardName ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.awardName && <p className="mt-1 text-xs text-red-500">{formErrors.awardName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ประเภท *</label>
              <select value={form.awardType} onChange={(e) => setForm((f) => ({ ...f, awardType: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
                {AWARD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ปี (พ.ศ.) *</label>
              <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} placeholder="เช่น 2568" className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.year ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.year && <p className="mt-1 text-xs text-red-500">{formErrors.year}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">รายละเอียด</label>
              <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
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

      {/* Doughnut Chart - only in view mode */}
      {!manageMode && Object.keys(typeCounts).length > 0 && (
        <div className="mb-8 flex justify-center">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="ค้นหาชื่อหรือรางวัล..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
        <select
          value={awardTypeFilter}
          onChange={(e) => handleFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        >
          <option value="">ทุกประเภท</option>
          {Object.entries(AWARD_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {manageMode && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => router.push("/new-alumni")} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            เพิ่มข้อมูล
          </button>
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            ส่งออก Excel
          </button>
          <input type="file" accept=".xlsx,.xls" ref={importFileRef} onChange={handleImport} className="hidden" />
          <button onClick={() => importFileRef.current?.click()} disabled={importing} className="inline-flex items-center gap-1.5 rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-600 hover:text-white transition-colors disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m16.5-12L12 7.5m0 0L7.5 4.5M12 7.5V21" /></svg>
            {importing ? "กำลังนำเข้า..." : "นำเข้า Excel"}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white text-left" style={{ backgroundColor: "#1e3a5f" }}>
                <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("name")}>
                  ชื่อ-นามสกุล <SortIcon field="name" />
                </th>
                <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("award")}>
                  ชื่อรางวัล <SortIcon field="award" />
                </th>
                <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("type")}>
                  ประเภท <SortIcon field="type" />
                </th>
                <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("year")}>
                  ปี <SortIcon field="year" />
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                  รายละเอียด
                </th>
                {manageMode && (
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">จัดการ</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={manageMode ? 6 : 5} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : sortedAwards.length === 0 ? (
                <tr>
                  <td colSpan={manageMode ? 6 : 5} className="px-4 py-12 text-center text-[var(--muted)]">ไม่พบข้อมูล</td>
                </tr>
              ) : (
                sortedAwards.map((award) => (
                  <tr key={award.id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3">{alumniDisplayName(award.alumni)}</td>
                    <td className="px-4 py-3">{award.awardName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: AWARD_COLORS[award.awardType] || "#999" }}>
                        {AWARD_TYPE_LABELS[award.awardType] || award.awardType}
                      </span>
                    </td>
                    <td className="px-4 py-3">{award.year}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-[var(--muted)]">{award.description || "-"}</td>
                    {manageMode && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(award)} className="rounded p-1.5 text-blue-600 hover:bg-blue-100" title="แก้ไข">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                          </button>
                          <button onClick={() => setDeleteId(award.id)} className="rounded p-1.5 text-red-500 hover:bg-red-100" title="ลบ">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {manageMode && (
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
        )}
      </div>

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
            <p className="mb-6 text-sm text-gray-600">คุณต้องการลบข้อมูลรางวัลนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
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

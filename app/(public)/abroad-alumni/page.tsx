"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { PAGE_SIZE } from "@/lib/constants";

interface AbroadAlumni {
  id: string;
  studentId: string;
  name: string;
  address: string | null;
  country: string;
  university: string | null;
  order: number;
}

interface ApiResponse {
  data: AbroadAlumni[];
  countries: string[];
}

const EMPTY_FORM = { studentId: "", name: "", address: "", country: "", university: "", order: "0" };

export default function AbroadAlumniPage() {
  const router = useRouter();
  const [alumni, setAlumni] = useState<AbroadAlumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pageByGroup, setPageByGroup] = useState<Record<string, number>>({});
  const perGroupPage = 10;

  const [manageMode, setManageMode] = useState(false);
  const [mgmtPage, setMgmtPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !(prev[label] ?? true) }));
  const pageFor = (label: string) => pageByGroup[label] ?? 1;
  const setPageFor = (label: string, p: number) =>
    setPageByGroup((prev) => ({ ...prev, [label]: p }));

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, country: countryFilter });
      const res = await fetch(`/api/abroad-alumni?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setAlumni(data.data);
      if (data.countries.length > 0 && countries.length === 0) {
        setCountries(data.countries);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, countryFilter, countries.length]);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  const grouped = useMemo(() => {
    const groups: { label: string; isUniversity: boolean; items: AbroadAlumni[] }[] = [];
    const byCountry = new Map<string, AbroadAlumni[]>();
    for (const a of alumni) {
      const list = byCountry.get(a.country) || [];
      list.push(a);
      byCountry.set(a.country, list);
    }
    for (const [country, items] of byCountry) {
      const withUni = items.filter((a) => a.university);
      const withoutUni = items.filter((a) => !a.university);
      if (withoutUni.length > 0) groups.push({ label: country, isUniversity: false, items: withoutUni });
      if (withUni.length > 0) {
        const byUni = new Map<string, AbroadAlumni[]>();
        for (const a of withUni) {
          const list = byUni.get(a.university!) || [];
          list.push(a);
          byUni.set(a.university!, list);
        }
        for (const [uni, uniItems] of byUni) {
          groups.push({ label: uni, isUniversity: true, items: uniItems });
        }
      }
    }
    return groups;
  }, [alumni]);

  // Management mode: flat sorted list
  const sortedAlumni = useMemo(() =>
    [...alumni].sort((a, b) => a.country.localeCompare(b.country) || (a.university || "").localeCompare(b.university || "") || a.order - b.order),
    [alumni]
  );
  const mgmtTotalPages = Math.max(1, Math.ceil(sortedAlumni.length / PAGE_SIZE));
  const pagedAlumni = sortedAlumni.slice((mgmtPage - 1) * PAGE_SIZE, mgmtPage * PAGE_SIZE);

  const openCreate = () => {
    router.push("/new-alumni");
  };

  const openEdit = (a: AbroadAlumni) => {
    setForm({
      studentId: a.studentId,
      name: a.name,
      address: a.address || "",
      country: a.country,
      university: a.university || "",
      order: String(a.order),
    });
    setFormErrors({});
    setEditingId(a.id);
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
    if (!form.studentId.trim()) errors.studentId = "กรุณากรอกรหัสนักศึกษา";
    if (!form.name.trim()) errors.name = "กรุณากรอกชื่อ";
    if (!form.country.trim()) errors.country = "กรุณากรอกประเทศ";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const payload = {
        studentId: form.studentId.trim(),
        name: form.name.trim(),
        address: form.address.trim() || null,
        country: form.country.trim(),
        university: form.university.trim() || null,
        order: Number(form.order) || 0,
      };
      const res = editingId
        ? await fetch(`/api/abroad-alumni/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/abroad-alumni", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }
      closeForm();
      fetchAlumni();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/abroad-alumni/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchAlumni();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const handleExport = () => {
    window.location.href = "/api/abroad-alumni/export";
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/abroad-alumni/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      setImportResult(data);
      fetchAlumni();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้า");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          ข้อมูลการทำงานต่างประเทศ
        </h1>
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

      {manageMode && showForm && (
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">
            {editingId ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">รหัสนักศึกษา *</label>
              <input type="text" value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.studentId ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.studentId && <p className="mt-1 text-xs text-red-500">{formErrors.studentId}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อ-นามสกุล *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.name ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ประเทศ *</label>
              <input type="text" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.country ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.country && <p className="mt-1 text-xs text-red-500">{formErrors.country}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">มหาวิทยาลัย</label>
              <input type="text" value={form.university} onChange={(e) => setForm((f) => ({ ...f, university: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ที่อยู่</label>
              <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ลำดับ</label>
              <input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
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

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="ค้นหาชื่อ สถาบัน หรือประเทศ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        >
          <option value="">ทุกประเทศ</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {manageMode && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
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

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : alumni.length === 0 ? (
        <div className="py-12 text-center text-[var(--muted)]">ไม่พบข้อมูล</div>
      ) : manageMode ? (
        /* Management mode: single flat table */
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--primary)] text-white">
                  <th className="w-16 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">ลำดับ</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">รหัสนักศึกษา</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ชื่อ-นามสกุล</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ประเทศ</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">มหาวิทยาลัย</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ที่อยู่</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {pagedAlumni.map((a, idx) => (
                  <tr key={a.id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 text-center">{(mgmtPage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm">{a.studentId}</td>
                    <td className="px-4 py-3">{a.name}</td>
                    <td className="px-4 py-3">{a.country}</td>
                    <td className="px-4 py-3">{a.university || "-"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{a.address || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(a)} className="rounded p-1.5 text-blue-600 hover:bg-blue-100" title="แก้ไข">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </button>
                        <button onClick={() => setDeleteId(a.id)} className="rounded p-1.5 text-red-500 hover:bg-red-100" title="ลบ">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mgmtTotalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 border-t border-[var(--border)] px-4 py-3">
              <button onClick={() => setMgmtPage(Math.max(1, mgmtPage - 1))} disabled={mgmtPage === 1} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50">ก่อนหน้า</button>
              {Array.from({ length: mgmtTotalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setMgmtPage(p)} className={`rounded-md px-3 py-1.5 text-sm ${mgmtPage === p ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] hover:bg-gray-50"}`}>{p}</button>
              ))}
              <button onClick={() => setMgmtPage(Math.min(mgmtTotalPages, mgmtPage + 1))} disabled={mgmtPage === mgmtTotalPages} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50">ถัดไป</button>
            </div>
          )}
        </div>
      ) : (
        /* View mode: grouped tables */
        <div className="space-y-8">
          {grouped.map((group) => {
            const isCollapsed = collapsed[group.label] ?? true;
            const page = pageFor(group.label);
            const totalPages = Math.ceil(group.items.length / perGroupPage);
            const paged = group.items.slice((page - 1) * perGroupPage, page * perGroupPage);

            return (
              <div key={group.label} className="overflow-hidden rounded-lg bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggle(group.label)}
                  className="flex w-full items-center justify-between bg-[var(--primary)] px-4 py-3 text-left"
                >
                  <h2 className="text-sm font-semibold text-white sm:text-base">{group.label}</h2>
                  <svg className={`h-5 w-5 shrink-0 text-white transition-transform ${isCollapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!isCollapsed && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white text-left" style={{ backgroundColor: "#1e3a5f" }}>
                            <th className="w-16 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ที่</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">รหัสนักศึกษา</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ชื่อ - นามสกุล</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ที่อยู่</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((a, idx) => (
                            <tr key={a.id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
                              <td className="px-4 py-3 text-center">{(page - 1) * perGroupPage + idx + 1}</td>
                              <td className="px-4 py-3 font-mono text-sm">{a.studentId}</td>
                              <td className="px-4 py-3">{a.name}</td>
                              <td className="px-4 py-3 text-[var(--muted)]">{a.address || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-1.5 border-t border-[var(--border)] px-4 py-3">
                        <button onClick={() => setPageFor(group.label, Math.max(1, page - 1))} disabled={page === 1} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50">ก่อนหน้า</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <button key={p} onClick={() => setPageFor(group.label, p)} className={`rounded-md px-3 py-1.5 text-sm ${page === p ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] hover:bg-gray-50"}`}>{p}</button>
                        ))}
                        <button onClick={() => setPageFor(group.label, Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50">ถัดไป</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการลบข้อมูล</h3>
            <p className="mb-6 text-sm text-gray-600">คุณต้องการลบข้อมูลนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
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

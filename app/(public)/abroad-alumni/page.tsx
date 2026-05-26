"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useCanWrite } from "@/lib/role-context";
import { PAGE_SIZE } from "@/lib/constants";

interface AbroadAlumni {
  id: string;
  cohort: string | null;
  prefix: string | null;
  thaiName: string | null;
  englishName: string | null;
  workplace: string | null;
  country: string;
  notes: string | null;
  order: number;
}

interface ApiResponse {
  data: AbroadAlumni[];
  countries: string[];
}

const EMPTY_FORM = {
  cohort: "",
  prefix: "คุณ",
  thaiName: "",
  englishName: "",
  workplace: "",
  country: "",
  notes: "",
  order: "0",
};

type SearchField = "all" | "thaiName" | "englishName" | "country" | "workplace" | "cohort";

const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "thaiName", label: "ชื่อไทย" },
  { value: "englishName", label: "ชื่ออังกฤษ" },
  { value: "country", label: "ประเทศ" },
  { value: "workplace", label: "สถานที่ทำงาน" },
  { value: "cohort", label: "รุ่น" },
];

function displayName(a: AbroadAlumni): string {
  if (a.thaiName && a.englishName) return `${a.thaiName} (${a.englishName})`;
  return a.thaiName || a.englishName || "-";
}

type SortField = "cohort" | "thaiName" | "englishName" | "country" | "workplace" | "notes" | "order";
type SortDir = "asc" | "desc";

const MGMT_SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: "cohort", label: "รุ่น" },
  { field: "thaiName", label: "ชื่อ-นามสกุล" },
  { field: "country", label: "ประเทศ" },
  { field: "workplace", label: "สถานที่ทำงาน" },
  { field: "notes", label: "หมายเหตุ" },
];

const VIEW_SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: "cohort", label: "รุ่น" },
  { field: "thaiName", label: "ชื่อ - นามสกุล" },
  { field: "englishName", label: "ชื่ออังกฤษ" },
  { field: "workplace", label: "สถานที่ทำงาน" },
  { field: "notes", label: "หมายเหตุ" },
];

function getFieldValue(a: AbroadAlumni, field: SortField): string {
  switch (field) {
    case "cohort": return a.cohort || "";
    case "thaiName": return a.thaiName || "";
    case "englishName": return a.englishName || "";
    case "country": return a.country;
    case "workplace": return a.workplace || "";
    case "notes": return a.notes || "";
    case "order": return String(a.order);
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg className="ml-1 inline h-3.5 w-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10l4-4 4 4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 14l4 4 4-4" />
      </svg>
    );
  }
  return (
    <svg className="ml-1 inline h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {dir === "asc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      )}
    </svg>
  );
}

export default function AbroadAlumniPage() {
  const canWrite = useCanWrite();
  const [alumni, setAlumni] = useState<AbroadAlumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
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

  const [mgmtSortField, setMgmtSortField] = useState<SortField>("country");
  const [mgmtSortDir, setMgmtSortDir] = useState<SortDir>("desc");
  const [viewSortField, setViewSortField] = useState<SortField>("cohort");
  const [viewSortDir, setViewSortDir] = useState<SortDir>("desc");

  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !(prev[label] ?? true) }));
  const pageFor = (label: string) => pageByGroup[label] ?? 1;
  const setPageFor = (label: string, p: number) =>
    setPageByGroup((prev) => ({ ...prev, [label]: p }));

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, country: countryFilter, searchField });
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
  }, [search, searchField, countryFilter, countries.length]);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  // Group by country
  const grouped = useMemo(() => {
    const groups: { country: string; items: AbroadAlumni[] }[] = [];
    const byCountry = new Map<string, AbroadAlumni[]>();
    for (const a of alumni) {
      const list = byCountry.get(a.country) || [];
      list.push(a);
      byCountry.set(a.country, list);
    }
    for (const [country, items] of byCountry) {
      const sorted = [...items].sort((a, b) => {
        const va = getFieldValue(a, viewSortField);
        const vb = getFieldValue(b, viewSortField);
        const cmp = va.localeCompare(vb, "th");
        return viewSortDir === "asc" ? cmp : -cmp;
      });
      groups.push({ country, items: sorted });
    }
    groups.sort((a, b) => b.items.length - a.items.length);
    return groups;
  }, [alumni, viewSortField, viewSortDir]);

  // Management mode: flat sorted list
  const sortedAlumni = useMemo(() =>
    [...alumni].sort((a, b) => {
      const va = getFieldValue(a, mgmtSortField);
      const vb = getFieldValue(b, mgmtSortField);
      const cmp = va.localeCompare(vb, "th");
      return mgmtSortDir === "asc" ? cmp : -cmp;
    }),
    [alumni, mgmtSortField, mgmtSortDir]
  );
  const mgmtTotalPages = Math.max(1, Math.ceil(sortedAlumni.length / PAGE_SIZE));
  const pagedAlumni = sortedAlumni.slice((mgmtPage - 1) * PAGE_SIZE, mgmtPage * PAGE_SIZE);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (a: AbroadAlumni) => {
    setForm({
      cohort: a.cohort || "",
      prefix: a.prefix || "",
      thaiName: a.thaiName || "",
      englishName: a.englishName || "",
      workplace: a.workplace || "",
      country: a.country,
      notes: a.notes || "",
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
    if (!form.thaiName.trim() && !form.englishName.trim()) errors.thaiName = "กรุณากรอกชื่อไทยหรือชื่ออังกฤษ";
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
        cohort: form.cohort.trim() || null,
        prefix: form.prefix.trim() || null,
        thaiName: form.thaiName.trim() || null,
        englishName: form.englishName.trim() || null,
        workplace: form.workplace.trim() || null,
        country: form.country.trim(),
        notes: form.notes.trim() || null,
        order: Number(form.order) || 0,
      };
      if (editingId) {
        const res = await fetch(`/api/abroad-alumni/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "เกิดข้อผิดพลาด");
        }
      } else {
        const res = await fetch("/api/abroad-alumni", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "เกิดข้อผิดพลาด");
        }
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
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          ข้อมูลการทำงานต่างประเทศ
        </h1>
        {!manageMode ? (
          canWrite && (<button onClick={() => setManageMode(true)} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            จัดการข้อมูล
          </button>)
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
              <label className="mb-1 block text-sm font-medium text-gray-700">รุ่น</label>
              <input type="text" value={form.cohort} onChange={(e) => setForm((f) => ({ ...f, cohort: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">คำนำหน้า</label>
              <input type="text" value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อไทย *</label>
              <input type="text" value={form.thaiName} onChange={(e) => setForm((f) => ({ ...f, thaiName: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.thaiName ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.thaiName && <p className="mt-1 text-xs text-red-500">{formErrors.thaiName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ชื่ออังกฤษ</label>
              <input type="text" value={form.englishName} onChange={(e) => setForm((f) => ({ ...f, englishName: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">สถานที่ทำงาน</label>
              <textarea value={form.workplace} onChange={(e) => setForm((f) => ({ ...f, workplace: e.target.value }))} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ประเทศ *</label>
              <input type="text" list="country-list" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.country ? "border-red-400" : "border-gray-300"}`} />
              <datalist id="country-list">
                {countries.map((c) => <option key={c} value={c} />)}
              </datalist>
              {formErrors.country && <p className="mt-1 text-xs text-red-500">{formErrors.country}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">หมายเหตุ</label>
              <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
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
        <select
          value={searchField}
          onChange={(e) => { setSearchField(e.target.value as SearchField); setSearch(""); }}
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
                  <th className="w-12 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">ลำดับ</th>
                  {MGMT_SORT_FIELDS.map(({ field, label }) => (
                    <th
                      key={field}
                      onClick={() => {
                        if (mgmtSortField === field) setMgmtSortDir((d) => d === "asc" ? "desc" : "asc");
                        else { setMgmtSortField(field); setMgmtSortDir("asc"); }
                      }}
                      className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10"
                    >
                      {label}
                      <SortIcon active={mgmtSortField === field} dir={mgmtSortField === field ? mgmtSortDir : "asc"} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {pagedAlumni.map((a, idx) => (
                  <tr key={a.id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 text-center">{(mgmtPage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{a.cohort || "-"}</td>
                    <td className="px-4 py-3">{displayName(a)}</td>
                    <td className="px-4 py-3">{a.country}</td>
                    <td className="px-4 py-3 text-[var(--muted)] max-w-xs truncate">{a.workplace || "-"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{a.notes || "-"}</td>
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
              <span className="text-sm text-gray-500">แสดง {sortedAlumni.length === 0 ? 0 : (mgmtPage - 1) * PAGE_SIZE + 1}-{Math.min(mgmtPage * PAGE_SIZE, sortedAlumni.length)} จาก {sortedAlumni.length} รายการ</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setMgmtPage(Math.max(1, mgmtPage - 1))} disabled={mgmtPage === 1} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
                {Array.from({ length: mgmtTotalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setMgmtPage(p)} className={`rounded-md px-3 py-1.5 text-sm ${mgmtPage === p ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"}`}>{p}</button>
                ))}
                <button onClick={() => setMgmtPage(Math.min(mgmtTotalPages, mgmtPage + 1))} disabled={mgmtPage === mgmtTotalPages} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* View mode: grouped by country */
        <div className="space-y-8">
          {grouped.map((group) => {
            const isCollapsed = collapsed[group.country] ?? true;
            const page = pageFor(group.country);
            const totalPages = Math.ceil(group.items.length / perGroupPage);
            const paged = group.items.slice((page - 1) * perGroupPage, page * perGroupPage);

            return (
              <div key={group.country} className="overflow-hidden rounded-lg bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggle(group.country)}
                  className="flex w-full items-center justify-between bg-[var(--primary)] px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-white sm:text-base">{group.country}</h2>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs text-white">{group.items.length} คน</span>
                  </div>
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
                            <th className="w-12 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">ลำดับ</th>
                            {VIEW_SORT_FIELDS.map(({ field, label }) => (
                              <th
                                key={field}
                                onClick={() => {
                                  if (viewSortField === field) setViewSortDir((d) => d === "asc" ? "desc" : "asc");
                                  else { setViewSortField(field); setViewSortDir("asc"); }
                                }}
                                className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10"
                              >
                                {label}
                                <SortIcon active={viewSortField === field} dir={viewSortField === field ? viewSortDir : "asc"} />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {paged.map((a, idx) => (
                            <tr key={a.id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
                              <td className="px-4 py-3 text-center">{(page - 1) * perGroupPage + idx + 1}</td>
                              <td className="px-4 py-3 text-[var(--muted)]">{a.cohort || "-"}</td>
                              <td className="px-4 py-3">{a.thaiName || a.englishName || "-"}</td>
                              <td className="px-4 py-3 text-[var(--muted)]">{a.englishName || "-"}</td>
                              <td className="px-4 py-3 text-[var(--muted)]">{a.workplace || "-"}</td>
                              <td className="px-4 py-3">
                                {a.notes ? (
                                  <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs text-red-700">{a.notes}</span>
                                ) : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
                        <span className="text-sm text-gray-500">แสดง {(page - 1) * perGroupPage + 1}-{Math.min(page * perGroupPage, group.items.length)} จาก {group.items.length} รายการ</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setPageFor(group.country, Math.max(1, page - 1))} disabled={page === 1} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <button key={p} onClick={() => setPageFor(group.country, p)} className={`rounded-md px-3 py-1.5 text-sm ${page === p ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"}`}>{p}</button>
                          ))}
                          <button onClick={() => setPageFor(group.country, Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
                        </div>
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

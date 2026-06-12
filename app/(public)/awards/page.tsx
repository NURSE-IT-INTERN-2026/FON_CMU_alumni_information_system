"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";
import { useCanWrite } from "@/lib/role-context";
import { AWARD_TYPE_LABELS, AWARD_TYPE_OPTIONS, PAGE_SIZE, BASE_PATH } from "@/lib/constants";
import { useBulkSelection } from "@/lib/useBulkSelection";
import { useAlumniSearch } from "@/lib/useAlumniSearch";
import { awardFormSchema, type AwardFormData } from "@/lib/validations";

interface Award {
  id: string;
  studentId: string | null;
  recipientName: string | null;
  awardName: string;
  awardType: string;
  year: number;
  description: string | null;
  alumni: {
    prefix: string;
    firstName: string;
    maidenLastName: string;
  } | null;
}

interface ApiResponse {
  data: Award[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const AWARD_COLORS: Record<string, string> = {
  INTERNATIONAL: "#5b21b6",
  NATIONAL: "#e8a838",
  LOCAL: "#38a169",
};

type SortField = "name" | "award" | "type" | "year";
type SortDir = "asc" | "desc";

type FormValues = AwardFormData & { studentId: string };

const DEFAULT_FORM_VALUES: FormValues = { studentId: "", awardName: "", awardType: "INTERNATIONAL" as const, year: "", description: "" };

type SearchField = "all" | "awardName" | "recipientName" | "description" | "name" | "year";

const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "name", label: "ชื่อ-นามสกุล" },
  { value: "awardName", label: "ชื่อรางวัล" },
  { value: "description", label: "รายละเอียด" },
  { value: "year", label: "ปี พ.ศ." },
];

const alumniDisplayName = (a: { prefix: string; firstName: string; maidenLastName: string } | null, fallback?: string | null) =>
  a ? `${a.prefix}${a.firstName} ${a.maidenLastName}` : (fallback || "ไม่ระบุชื่อ");

export default function AwardsPage() {
  const canWrite = useCanWrite();
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [awardTypeFilter, setAwardTypeFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});

  const [manageMode, setManageMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors }, reset: formReset, control, getValues, setValue } = useForm<FormValues>({
    resolver: zodResolver(awardFormSchema) as any,
    defaultValues: DEFAULT_FORM_VALUES,
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const {
    selectedIds,
    selectedCount,
    toggleSelect,
    selectAll,
    deselectAll,
    isSelected,
    isAllSelected,
    getSelectedArray,
  } = useBulkSelection();
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Alumni search for form
  const [nameSearch, setNameSearch] = useState("");
  const [formSearchField, setFormSearchField] = useState<"studentId" | "name" | null>(null);
  const { alumniResults, showAlumniDropdown, searchAlumni, clearResults, displayName } = useAlumniSearch();

  const fetchAwards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
        awardType: awardTypeFilter,
        sortField,
        sortDir,
        searchField,
      });
      const res = await fetch(`${BASE_PATH}/api/awards?${params}`);
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
  }, [page, search, searchField, awardTypeFilter, sortField, sortDir]);

  const fetchTypeCounts = useCallback(async () => {
    try {
      const [international, national, local] = await Promise.all([
        fetch(`${BASE_PATH}/api/awards?pageSize=1&awardType=INTERNATIONAL`).then((r) => r.json()),
        fetch(`${BASE_PATH}/api/awards?pageSize=1&awardType=NATIONAL`).then((r) => r.json()),
        fetch(`${BASE_PATH}/api/awards?pageSize=1&awardType=LOCAL`).then((r) => r.json()),
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
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 inline-block">{sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▽"}</span>
  );

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);
  const rowNumber = (index: number) => (page - 1) * PAGE_SIZE + index + 1;

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

  const selectAlumni = (a: { id: string; studentId: string; prefix: string; firstName: string; maidenLastName: string }) => {
    setValue("studentId", a.studentId);
    setNameSearch(displayName(a));
    clearResults();
    setFormSearchField(null);
  };

  const openCreate = () => {
    formReset(DEFAULT_FORM_VALUES);
    setNameSearch("");
    setFormSearchField(null);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (a: Award) => {
    formReset({
      studentId: a.studentId || "",
      awardName: a.awardName,
      awardType: a.awardType as "INTERNATIONAL" | "NATIONAL" | "LOCAL",
      year: String(a.year),
      description: a.description || "",
    });
    setNameSearch(alumniDisplayName(a.alumni, a.recipientName));
    setEditingId(a.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    formReset(DEFAULT_FORM_VALUES);
    setNameSearch("");
    setFormSearchField(null);
    clearResults();
  };

  const onSave = async (data: AwardFormData) => {
    const studentId = getValues("studentId");
    setSaving(true);
    setErrorMsg("");
    try {
      if (editingId) {
        // Edit mode
        const payload = {
          studentId: studentId || null,
          recipientName: studentId ? null : (nameSearch.trim() || null),
          awardName: data.awardName.trim(),
          awardType: data.awardType,
          year: Number(data.year),
          description: data.description.trim() || null,
        };
        const res = await fetch(`${BASE_PATH}/api/awards/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "เกิดข้อผิดพลาด");
        }
      } else {
        // Create mode
        const payload = {
          studentId: studentId || null,
          recipientName: studentId ? null : (nameSearch.trim() || null),
          awardName: data.awardName.trim(),
          awardType: data.awardType,
          year: Number(data.year),
          description: data.description.trim() || null,
        };
        const res = await fetch(`${BASE_PATH}/api/awards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "เกิดข้อผิดพลาด");
        }
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
      const res = await fetch(`${BASE_PATH}/api/awards/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchAwards();
      fetchTypeCounts();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const handleBulkDelete = async () => {
    const ids = getSelectedArray();
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${BASE_PATH}/api/awards/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }
      deselectAll();
      setShowBulkDeleteDialog(false);
      fetchAwards();
      fetchTypeCounts();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkExport = async () => {
    const ids = getSelectedArray();
    if (ids.length === 0) return;
    try {
      const res = await fetch(`${BASE_PATH}/api/awards/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("เกิดข้อผิดพลาด");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "awards_export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      deselectAll();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการส่งออกข้อมูล");
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (searchField !== "all") params.set("searchField", searchField);
    if (awardTypeFilter) params.set("awardType", awardTypeFilter);
    params.set("sortField", sortField);
    params.set("sortDir", sortDir);
    window.location.href = `${BASE_PATH}/api/awards/export?${params}`;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE_PATH}/api/awards/import`, { method: "POST", body: formData });
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
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">รางวัลที่ได้รับ</h1>
        {!manageMode ? (
          canWrite && (<button onClick={() => { setManageMode(true); deselectAll(); }} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            จัดการข้อมูล
          </button>)
        ) : (
          <button onClick={() => { setManageMode(false); closeForm(); deselectAll(); }} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50">
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
            {editingId ? "แก้ไขข้อมูลรางวัล" : "เพิ่มข้อมูลรางวัล"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-gray-700">รหัสนักศึกษา</label>
              <Controller name="studentId" control={control} render={({ field }) => (
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => { field.onChange(e.target.value); searchAlumni(e.target.value); setFormSearchField("studentId"); setNameSearch(""); }}
                  placeholder="พิมพ์รหัสนักศึกษา..."
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] border-gray-300"
                />
              )} />
              {showAlumniDropdown && formSearchField === "studentId" && alumniResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {alumniResults.map((a) => (
                    <button key={a.id} type="button" onClick={() => selectAlumni(a)} className="block w-full px-3 py-2 text-left text-sm hover:bg-purple-50 transition-colors">
                      {a.studentId} - {displayName(a)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อ-นามสกุล</label>
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => { setNameSearch(e.target.value); searchAlumni(e.target.value); setFormSearchField("name"); setValue("studentId", ""); }}
                placeholder="พิมพ์ชื่อเพื่อค้นหาศิษย์เก่า..."
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] border-gray-300"
              />
              {showAlumniDropdown && formSearchField === "name" && alumniResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {alumniResults.map((a) => (
                    <button key={a.id} type="button" onClick={() => selectAlumni(a)} className="block w-full px-3 py-2 text-left text-sm hover:bg-purple-50 transition-colors">
                      {a.studentId} - {displayName(a)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <FormField label="ชื่อรางวัล" required error={errors.awardName?.message}>
              <FormInput registration={register("awardName")} error={errors.awardName?.message} type="text" />
            </FormField>
            <FormField label="ประเภท" required error={errors.awardType?.message}>
              <FormSelect registration={register("awardType")} error={errors.awardType?.message}>
                {AWARD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="ปี (พ.ศ.)" required error={errors.year?.message}>
              <FormInput registration={register("year")} error={errors.year?.message} type="text" placeholder="เช่น 2568" />
            </FormField>
            <FormField label="รายละเอียด" required error={errors.description?.message} className="sm:col-span-2">
              <FormInput registration={register("description")} error={errors.description?.message} type="text" />
            </FormField>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={closeForm} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
            <button onClick={handleSubmit(onSave)} disabled={saving} className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {/* Award type summary cards - only in view mode */}
      {!manageMode && Object.keys(typeCounts).length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              key: "INTERNATIONAL",
              label: AWARD_TYPE_LABELS["INTERNATIONAL"],
              color: AWARD_COLORS["INTERNATIONAL"],
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.466.732-3.558" />
                </svg>
              ),
            },
            {
              key: "NATIONAL",
              label: AWARD_TYPE_LABELS["NATIONAL"],
              color: AWARD_COLORS["NATIONAL"],
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-4.5A3.375 3.375 0 0 0 13.125 10.875h-2.25A3.375 3.375 0 0 0 7.5 14.25v4.5m6-15a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              ),
            },
            {
              key: "LOCAL",
              label: AWARD_TYPE_LABELS["LOCAL"],
              color: AWARD_COLORS["LOCAL"],
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              ),
            },
          ].map(({ key, label, color, icon }) => (
            <div key={key} className="rounded-xl border-l-4 bg-white p-5 shadow-sm" style={{ borderLeftColor: color }}>
              <div className="rounded-lg p-2" style={{ backgroundColor: `${color}10`, color }}>
                {icon}
              </div>
              <p className="mt-3 text-xs font-medium text-[var(--muted)]">{label}</p>
              <p className="mt-1 text-2xl font-bold sm:text-3xl" style={{ color }}>
                {(typeCounts[key] ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
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

      {manageMode && !showForm && (
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
          {selectedCount > 0 && (
            <>
              <button
                onClick={() => setShowBulkDeleteDialog(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                ลบที่เลือก ({selectedCount})
              </button>
              <button
                onClick={handleBulkExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-500 hover:text-white transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                ส่งออกที่เลือก ({selectedCount})
              </button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white text-left" style={{ backgroundColor: "#5b21b6" }}>
                {manageMode && (
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={awards.length > 0 && isAllSelected(awards.map((a) => a.id))}
                      onChange={(e) => {
                        if (e.target.checked) selectAll(awards.map((a) => a.id));
                        else deselectAll();
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                  ลำดับ
                </th>
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
                  ปีที่ได้รับ <SortIcon field="year" />
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
                  <td colSpan={manageMode ? 8 : 6} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : awards.length === 0 ? (
                <tr>
                  <td colSpan={manageMode ? 8 : 6} className="px-4 py-12 text-center text-[var(--muted)]">ไม่พบข้อมูล</td>
                </tr>
              ) : (
                awards.map((award, i) => (
                  <tr key={award.id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
                    {manageMode && (
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected(award.id)}
                          onChange={() => toggleSelect(award.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-center text-gray-500">{rowNumber(i)}</td>
                    <td className="px-4 py-3">{alumniDisplayName(award.alumni, award.recipientName)}</td>
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
                          <button onClick={() => openEdit(award)} className="rounded p-1.5 text-purple-600 hover:bg-purple-100" title="แก้ไข">
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
            <div className="flex items-center gap-1 flex-wrap justify-center">
              <button onClick={() => { setPage(Math.max(1, page - 1)); deselectAll(); }} disabled={page === 1} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">ก่อนหน้า</button>
              {paginationNumbers.map((p, i) =>
                p === "..." ? <span key={`dot-${i}`} className="px-2 text-gray-400">...</span> : (
                  <button key={p} onClick={() => { setPage(p as number); deselectAll(); }} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${page === p ? "bg-[var(--primary)] text-white" : "text-gray-600 bg-white hover:bg-gray-100"}`}>{p}</button>
                )
              )}
              <button onClick={() => { setPage(Math.min(totalPages, page + 1)); deselectAll(); }} disabled={page === totalPages} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">ถัดไป</button>
            </div>
          </div>
        )}
      </div>

      {!manageMode && totalPages > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm text-gray-500">แสดง {pageStart}-{pageEnd} จาก {total} รายการ</span>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
            {paginationNumbers.map((p, i) =>
              p === "..." ? <span key={`dot-${i}`} className="px-2 text-gray-400">...</span> : (
                <button key={p} onClick={() => setPage(p as number)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${p === page ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"}`}>{p}</button>
              )
            )}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
          </div>
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

      {showBulkDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการลบข้อมูล</h3>
            <p className="mb-6 text-sm text-gray-600">
              คุณต้องการลบข้อมูล <span className="font-bold text-red-600">{selectedCount}</span> รายการหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBulkDeleteDialog(false)} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {bulkDeleting ? "กำลังลบ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

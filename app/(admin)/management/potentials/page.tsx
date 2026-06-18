"use client";

import { useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import { useCanWrite } from "@/lib/role-context";
import { useRouter } from "next/navigation";
import { PAGE_SIZE, BASE_PATH, EDIT_REASON_OPTIONS } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { useEntityList } from "@/lib/use-entity-list";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import OrangeCell from "@/components/OrangeCell";
import { useHotFields } from "@/lib/use-hot-fields";
import { useBulkSelection } from "@/lib/useBulkSelection";
import { useAlumniSearch } from "@/lib/useAlumniSearch";
import { facetQueryParams } from "@/lib/filter-facets";
import FacetFilter from "@/components/ui/facet-filter";
import { potentialFormSchema, type PotentialFormData } from "@/lib/validations";

interface Potential {
  id: string;
  studentId: string;
  fullName: string;
  career: string;
  position: string;
  recordedYear: number;
  major?: string | null;
}

type SortField = "studentId" | "fullName" | "career" | "position" | "recordedYear" | "major";
type SortDir = "asc" | "desc";
type SearchField = "all" | "studentId" | "fullName" | "career" | "position" | "recordedYear";

const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "studentId", label: "รหัสนักศึกษา" },
  { value: "fullName", label: "ชื่อ-สกุล" },
  { value: "career", label: "อาชีพ" },
  { value: "position", label: "ตำแหน่ง" },
  { value: "recordedYear", label: "ปีที่บันตึก" },
];

type FormValues = PotentialFormData & { studentId: string; fullName: string; major: string };

const FORM_DEFAULTS: FormValues = { studentId: "", fullName: "", major: "", career: "", position: "", recordedYear: "" };

export default function PotentialsPage() {
  const canWrite = useCanWrite();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [sortField, setSortField] = useState<SortField>("recordedYear");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const filtersKey = facetQueryParams(filters).toString();

  const qc = useQueryClient();
  const { items: potentials, total, totalPages, isPending: loading, isError } = useEntityList<Potential>(
    "potentials",
    "/api/potentials",
    { page, search, searchField, sortField, sortDir, filters, filtersKey },
    { sortKey: "sortBy" },
  );

  const [manageMode, setManageMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");
  const { register, handleSubmit, formState: { errors }, reset: formReset, control, getValues, setValue } = useForm<FormValues>({
    resolver: zodResolver(potentialFormSchema) as any,
    defaultValues: FORM_DEFAULTS,
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
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; errors: { row: number; message: string }[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [formSearchField, setFormSearchField] = useState<"studentId" | "fullName" | null>(null);
  const { alumniResults, showAlumniDropdown, searchAlumni, clearResults, displayName } = useAlumniSearch();
  const hot = useHotFields("potential", potentials.map((p) => p.id));

  const selectAlumni = (a: { id: string; studentId: string; prefix: string; firstName: string; maidenLastName: string; major?: string }) => {
    setValue("studentId", a.studentId);
    setValue("fullName", displayName(a));
    setValue("major", a.major ?? "");
    setFormSearchField(null);
    clearResults();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const setFilter = (field: string, vals: string[]) => {
    setFilters((prev) => ({ ...prev, [field]: vals }));
    setPage(1);
  };

  const rowNumber = (index: number) => (page - 1) * PAGE_SIZE + index + 1;

  const openCreate = () => {
    formReset(FORM_DEFAULTS);
    setEditingId(null);
    setEditReason("");
    setShowForm(true);
  };

  const openEdit = (p: Potential) => {
    formReset({
      studentId: p.studentId,
      fullName: p.fullName,
      major: p.major || "",
      career: p.career,
      position: p.position,
      recordedYear: String(p.recordedYear),
    });
    setEditingId(p.id);
    setEditReason("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditReason("");
    formReset(FORM_DEFAULTS);
    setFormSearchField(null);
    clearResults();
  };

  const onSave = async (data: PotentialFormData) => {
    const studentId = getValues("studentId");
    const fullName = getValues("fullName");
    setErrorMsg("");
    if (editingId && !editReason) {
      setErrorMsg("กรุณาเลือกเหตุผลในการแก้ไข");
      return;
    }
    setSaving(true);
    try {
      const payload = { studentId, fullName, major: getValues("major")?.trim() || null, ...data, recordedYear: Number(data.recordedYear), ...(editingId ? { reason: editReason } : {}) };
      if (editingId) {
        await apiFetch(`/api/potentials/${editingId}`, { method: "PUT", json: payload });
      } else {
        await apiFetch(`/api/potentials`, { method: "POST", json: payload });
      }
      closeForm();
      qc.invalidateQueries({ queryKey: queryKeys.potentials.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/api/potentials/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: queryKeys.potentials.all });
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
      await apiFetch(`/api/potentials/bulk-delete`, { method: "POST", json: { ids } });
      deselectAll();
      setShowBulkDeleteDialog(false);
      qc.invalidateQueries({ queryKey: queryKeys.potentials.all });
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
      const res = await fetch(`${BASE_PATH}/api/potentials/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("เกิดข้อผิดพลาด");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "potentials_export.xlsx";
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
    params.set("sortBy", sortField);
    params.set("sortOrder", sortDir);
    window.location.href = `${BASE_PATH}/api/potentials/export?${params}`;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiFetch<{ imported: number; updated: number; errors: { row: number; message: string }[] }>(
        `/api/potentials/import`,
        { method: "POST", body: formData },
      );
      setImportResult(data);
      qc.invalidateQueries({ queryKey: queryKeys.potentials.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้า");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
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
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          ศักยภาพ
        </h1>
        {!manageMode ? (
          canWrite && (<button
            onClick={() => { setManageMode(true); deselectAll(); }}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            จัดการข้อมูล
          </button>)
        ) : (
          <button
            onClick={() => { setManageMode(false); setShowForm(false); deselectAll(); }}
            className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50"
          >
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
            <span>นำเข้าสำเร็จ {importResult.imported} รายการ{importResult.updated > 0 && ` (อัปเดต ${importResult.updated} รายการ)`}</span>
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
            {editingId ? "แก้ไขข้อมูลศักยภาพ" : "เพิ่มข้อมูลศักยภาพ"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {editingId ? (
              <>
                <FormField label="รหัสนักศึกษา" required>
                  <FormInput registration={register("studentId")} type="text" />
                </FormField>
                <FormField label="ชื่อ-สกุล" required>
                  <FormInput registration={register("fullName")} type="text" />
                </FormField>
              </>
            ) : (
              <>
                <div className="relative">
                  <label className="mb-1 block text-sm font-medium text-gray-700">รหัสนักศึกษา *</label>
                  <Controller
                    name="studentId"
                    control={control}
                    render={({ field }) => (
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => { field.onChange(e.target.value); setValue("fullName", ""); searchAlumni(e.target.value); setFormSearchField("studentId"); }}
                        placeholder="พิมพ์รหัสนักศึกษา..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    )}
                  />
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อ-นามสกุล *</label>
                  <Controller
                    name="fullName"
                    control={control}
                    render={({ field }) => (
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => { field.onChange(e.target.value); setValue("studentId", ""); searchAlumni(e.target.value); setFormSearchField("fullName"); }}
                        placeholder="พิมพ์ชื่อเพื่อค้นหาศิษย์เก่า..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    )}
                  />
                  {showAlumniDropdown && formSearchField === "fullName" && alumniResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                      {alumniResults.map((a) => (
                        <button key={a.id} type="button" onClick={() => selectAlumni(a)} className="block w-full px-3 py-2 text-left text-sm hover:bg-purple-50 transition-colors">
                          {a.studentId} - {displayName(a)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            <FormField label="สาขาวิชา">
              <FormInput registration={register("major")} type="text" />
            </FormField>
            <FormField label="อาชีพ" required error={errors.career?.message}>
              <FormInput registration={register("career")} error={errors.career?.message} type="text" />
            </FormField>
            <FormField label="ตำแหน่ง" required error={errors.position?.message}>
              <FormInput registration={register("position")} error={errors.position?.message} type="text" />
            </FormField>
            <FormField label="ปีที่บันทึก (พ.ศ.)" required error={errors.recordedYear?.message}>
              <FormInput registration={register("recordedYear")} error={errors.recordedYear?.message} type="number" placeholder="เช่น 2568" />
            </FormField>
          </div>
          {editingId && (
            <FormField label="เหตุผลในการแก้ไข" required>
              <select
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              >
                <option value="">— กรุณาเลือก —</option>
                {EDIT_REASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </FormField>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={closeForm} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
            <button onClick={handleSubmit(onSave)} disabled={saving} className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {manageMode && (
        <div className="mb-4 flex flex-wrap gap-2">
          {/* keep existing add button but update the wrapper */}
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

      {/* Search */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
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
          className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] sm:max-w-md"
        />
      </div>

      {/* Facet filters */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FacetFilter entity="potentials" field="major" label="สาขาวิชา" selected={filters.major ?? []} onChange={(v) => setFilter("major", v)} />
        <FacetFilter entity="potentials" field="career" label="อาชีพ" selected={filters.career ?? []} onChange={(v) => setFilter("career", v)} />
        <FacetFilter entity="potentials" field="position" label="ตำแหน่ง" selected={filters.position ?? []} onChange={(v) => setFilter("position", v)} />
        <FacetFilter entity="potentials" field="recordedYear" label="ปีที่บันทึก" selected={filters.recordedYear ?? []} onChange={(v) => setFilter("recordedYear", v)} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</p>
        </div>
      ) : potentials.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-[var(--muted)]">ไม่พบข้อมูล</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--primary)] text-white">
                {manageMode && (
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={potentials.length > 0 && isAllSelected(potentials.map((item) => item.id))}
                      onChange={(e) => {
                        if (e.target.checked) selectAll(potentials.map((item) => item.id));
                        else deselectAll();
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                  ลำดับ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("studentId")}>
                  รหัสนักศึกษา {sortField === "studentId" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("fullName")}>
                  ชื่อ-สกุล {sortField === "fullName" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("career")}>
                  อาชีพ {sortField === "career" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("position")}>
                  ตำแหน่ง {sortField === "position" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("major")}>
                  สาขาวิชา {sortField === "major" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("recordedYear")}>
                  ปีที่บันทึก {sortField === "recordedYear" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
                </th>
                {manageMode && (
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">จัดการ</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {potentials.map((p, i) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  {manageMode && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-center text-gray-500">{rowNumber(i)}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{p.studentId}</td>
                  <td className="px-4 py-3">{p.fullName}</td>
                  <td className="px-4 py-3"><OrangeCell resourceType="potential" recordId={p.id} field="career" value={p.career} hotFields={hot[p.id]} /></td>
                  <td className="px-4 py-3"><OrangeCell resourceType="potential" recordId={p.id} field="position" value={p.position} hotFields={hot[p.id]} /></td>
                  <td className="px-4 py-3">{p.major || "-"}</td>
                  <td className="px-4 py-3 text-center"><OrangeCell resourceType="potential" recordId={p.id} field="recordedYear" value={p.recordedYear} hotFields={hot[p.id]} /></td>
                  {manageMode && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(p)} className="rounded p-1.5 text-purple-600 hover:bg-purple-100" title="แก้ไข">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </button>
                        <button onClick={() => setDeleteId(p.id)} className="rounded p-1.5 text-red-500 hover:bg-red-100" title="ลบ">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {manageMode && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
              <span className="text-sm text-gray-500">แสดง {pageStart}-{pageEnd} จาก {total} รายการ</span>
              <div className="flex items-center gap-1">
                <button onClick={() => { setPage(Math.max(1, page - 1)); deselectAll(); }} disabled={page === 1} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">ก่อนหน้า</button>
                {paginationNumbers.map((p, i) =>
                  p === "..." ? <span key={`dot-${i}`} className="px-2 text-gray-400">...</span> : (
                    <button key={p} onClick={() => { setPage(p); deselectAll(); }} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${page === p ? "bg-[var(--primary)] text-white" : "text-gray-600 bg-white hover:bg-gray-100"}`}>{p}</button>
                  )
                )}
                <button onClick={() => { setPage(Math.min(totalPages, page + 1)); deselectAll(); }} disabled={page === totalPages} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">ถัดไป</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!manageMode && totalPages > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm text-gray-500">แสดง {pageStart}-{pageEnd} จาก {total} รายการ</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`rounded-md px-3 py-1.5 text-sm ${p === page ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"}`}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการลบข้อมูล</h3>
            <p className="mb-6 text-sm text-gray-600">คุณต้องการลบข้อมูลศักยภาพนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
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

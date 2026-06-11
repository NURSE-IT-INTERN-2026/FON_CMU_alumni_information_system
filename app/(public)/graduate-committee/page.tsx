"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useCanWrite } from "@/lib/role-context";
import { useRouter } from "next/navigation";
import { PAGE_SIZE, BASE_PATH } from "@/lib/constants";
import { useBulkSelection } from "@/lib/useBulkSelection";
import { useAlumniSearch } from "@/lib/useAlumniSearch";

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
type SearchField = "all" | "studentId" | "fullName" | "cohort" | "position" | "remarks" | "termYear";

const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "studentId", label: "รหัสนักศึกษา" },
  { value: "fullName", label: "ชื่อ-สกุล" },
  { value: "cohort", label: "รุ่นที่" },
  { value: "position", label: "ตำแหน่ง" },
  { value: "remarks", label: "หมายเหตุ" },
  { value: "termYear", label: "ปี พ.ศ." },
];

const EMPTY_FORM = { termYear: "", studentId: "", fullName: "", cohort: "", position: "", remarks: "" };

export default function GraduateCommitteePage() {
  const canWrite = useCanWrite();
  const router = useRouter();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [filterCohort, setFilterCohort] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [cohortOptions, setCohortOptions] = useState<string[]>([]);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("cohort");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [manageMode, setManageMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
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
  const [alumniSearchField, setAlumniSearchField] = useState<"studentId" | "fullName" | null>(null);
  const { alumniResults, showAlumniDropdown, searchAlumni, clearResults, displayName } = useAlumniSearch();

  const selectAlumni = (a: { id: string; studentId: string; prefix: string; firstName: string; maidenLastName: string }) => {
    setForm((f) => ({ ...f, studentId: a.studentId, fullName: displayName(a) }));
    setAlumniSearchField(null);
    clearResults();
  };

  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_PATH}/api/graduate-committee?pageSize=9999`);
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

      const res = await fetch(`${BASE_PATH}/api/graduate-committee?${params}`);
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
    setAlumniSearchField(null);
    clearResults();
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.termYear.trim()) errors.termYear = "กรุณากรอกปี พ.ศ.";
    if (form.termYear && isNaN(Number(form.termYear))) errors.termYear = "ปี พ.ศ. ต้องเป็นตัวเลข";
    if (!form.studentId.trim()) errors.studentId = "กรุณากรอกรหัสนักศึกษา";
    if (!form.fullName.trim()) errors.fullName = "กรุณากรอกชื่อ-นามสกุล";
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
      if (editingId) {
        const payload = { ...form, termYear: Number(form.termYear) };
        const res = await fetch(`${BASE_PATH}/api/graduate-committee/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "เกิดข้อผิดพลาด");
        }
      } else {
        if (form.studentId) {
          const payload = { ...form, termYear: Number(form.termYear) };
          const res = await fetch(`${BASE_PATH}/api/graduate-committee`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "เกิดข้อผิดพลาด");
          }
        } else {
          const params = new URLSearchParams({ section: "committees", nameSearch: form.fullName });
          if (form.termYear) params.set("termYear", form.termYear);
          if (form.cohort) params.set("cohort", form.cohort);
          if (form.position) params.set("position", form.position);
          if (form.remarks) params.set("remarks", form.remarks);
          router.push(`/new-alumni?${params.toString()}`);
          return;
        }
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
      const res = await fetch(`${BASE_PATH}/api/graduate-committee/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchCommittees();
      fetchFilterOptions();
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
      const res = await fetch(`${BASE_PATH}/api/graduate-committee/bulk-delete`, {
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
      fetchCommittees();
      fetchFilterOptions();
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
      const res = await fetch(`${BASE_PATH}/api/graduate-committee/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("เกิดข้อผิดพลาด");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "graduate_committee_export.xlsx";
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
    if (filterCohort) params.set("cohort", filterCohort);
    if (filterPosition) params.set("position", filterPosition);
    params.set("sortBy", sortField);
    params.set("sortOrder", sortDir);
    window.location.href = `${BASE_PATH}/api/graduate-committee/export?${params}`;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE_PATH}/api/graduate-committee/import`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      setImportResult(data);
      fetchCommittees();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้า");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">กรรมการบัณฑิต</h1>
        {!manageMode ? (
          canWrite && (
          <button onClick={() => { setManageMode(true); deselectAll(); }} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            จัดการข้อมูล
          </button>
          )
        ) : (
          <button onClick={() => { setManageMode(false); setShowForm(false); deselectAll(); }} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50">
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
            {editingId ? "แก้ไขข้อมูลกรรมการบัณฑิต" : "เพิ่มข้อมูลกรรมการบัณฑิต"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ปี พ.ศ. *</label>
              <input type="number" value={form.termYear} onChange={(e) => setForm((f) => ({ ...f, termYear: e.target.value }))} placeholder="เช่น 2568" className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.termYear ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.termYear && <p className="mt-1 text-xs text-red-500">{formErrors.termYear}</p>}
            </div>
            {editingId ? (
              <>
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
              </>
            ) : (
              <>
                <div className="relative">
                  <label className="mb-1 block text-sm font-medium text-gray-700">รหัสนักศึกษา *</label>
                  <input
                    type="text"
                    value={form.studentId}
                    onChange={(e) => { setForm((f) => ({ ...f, studentId: e.target.value, fullName: "" })); searchAlumni(e.target.value); setAlumniSearchField("studentId"); }}
                    placeholder="พิมพ์รหัสนักศึกษา..."
                    className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.studentId ? "border-red-400" : "border-gray-300"}`}
                  />
                  {formErrors.studentId && <p className="mt-1 text-xs text-red-500">{formErrors.studentId}</p>}
                  {showAlumniDropdown && alumniSearchField === "studentId" && alumniResults.length > 0 && (
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
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => { setForm((f) => ({ ...f, fullName: e.target.value, studentId: "" })); searchAlumni(e.target.value); setAlumniSearchField("fullName"); }}
                    placeholder="พิมพ์ชื่อเพื่อค้นหาศิษย์เก่า..."
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.fullName ? "border-red-400" : "border-gray-300"}`}
                  />
                  {formErrors.fullName && <p className="mt-1 text-xs text-red-500">{formErrors.fullName}</p>}
                  {showAlumniDropdown && alumniSearchField === "fullName" && alumniResults.length > 0 && (
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
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
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
                <tr className="text-white text-left" style={{ backgroundColor: "#5b21b6" }}>
                  {manageMode && (
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={committees.length > 0 && isAllSelected(committees.map((c) => c.id))}
                        onChange={(e) => {
                          if (e.target.checked) selectAll(committees.map((c) => c.id));
                          else deselectAll();
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                    ลำดับ
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("termYear")}>
                    ปี พ.ศ. {sortField === "termYear" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("studentId")}>
                    รหัสนักศึกษา {sortField === "studentId" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("fullName")}>
                    ชื่อ-สกุล {sortField === "fullName" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("cohort")}>
                    รุ่นที่ {sortField === "cohort" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/10" onClick={() => handleSort("position")}>
                    ตำแหน่ง {sortField === "position" ? (sortDir === "asc" ? "▲" : "▼") : "▽"}
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
                    {manageMode && (
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-center text-gray-500">{rowNumber(i)}</td>
                    <td className="px-4 py-3 text-center">{c.termYear}</td>
                    <td className="px-4 py-3 font-mono">{c.studentId}</td>
                    <td className="px-4 py-3">{c.fullName}</td>
                    <td className="px-4 py-3 text-center">{c.cohort}</td>
                    <td className="px-4 py-3">{c.position}</td>
                    <td className="px-4 py-3 text-gray-500">{c.remarks || "-"}</td>
                    {manageMode && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(c)} className="rounded p-1.5 text-purple-600 hover:bg-purple-100" title="แก้ไข">
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
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
              <span className="text-sm text-gray-500">แสดง {pageStart}-{pageEnd} จาก {total} รายการ</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setPage(Math.max(1, page - 1)); if (manageMode) deselectAll(); }} disabled={page === 1} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
                {paginationNumbers.map((p, i) =>
                  p === "..." ? (
                    <span key={`dot-${i}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button key={p} onClick={() => { setPage(p); if (manageMode) deselectAll(); }} className={`rounded-md px-3 py-1.5 text-sm ${
                      page === p
                        ? "bg-[var(--primary)] text-white"
                        : "border border-[var(--border)] bg-white hover:bg-gray-100"
                    }`}>{p}</button>
                  )
                )}
                <button onClick={() => { setPage(Math.min(totalPages, page + 1)); if (manageMode) deselectAll(); }} disabled={page === totalPages} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
              </div>
            </div>
          )}
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

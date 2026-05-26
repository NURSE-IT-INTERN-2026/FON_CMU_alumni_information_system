"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useCanWrite } from "@/lib/role-context";
import { useRouter } from "next/navigation";
import { PAGE_SIZE } from "@/lib/constants";
import { useBulkSelection } from "@/lib/useBulkSelection";

interface ModelRepresentative {
  id: string;
  studentId: string;
  name: string;
  cohort: string;
  generation: number;
}

interface ApiResponse {
  data: ModelRepresentative[];
}

const COHORT_ORDER = [
  "รายชื่อเครือข่ายศิษย์เก่าอนุปริญญาพยาบาล",
  "รายชื่อเครือข่ายศิษย์เก่าปริญญาพยาบาล",
  "รายชื่อเครือข่ายศิษย์เก่าปริญญาโท",
  "รายชื่อเครือข่ายศิษย์เก่าปริญญาเอก",
  "รายชื่อเครือข่ายศิษย์เก่าผู้ช่วยพยาบาล",
];

type ViewSortField = "generation" | "studentId" | "name";
type MgmtSortField = "generation" | "studentId" | "cohort" | "name";
type SortDir = "asc" | "desc";

const EMPTY_FORM = { studentId: "", name: "", cohort: "", generation: "" };

function SortIcon({ active, dir, className }: { active: boolean; dir: SortDir; className?: string }) {
  const color = className ?? "text-white";
  if (!active) {
    return (
      <svg className={`ml-1 inline h-3.5 w-3.5 ${color} opacity-30`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10l4-4 4 4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 14l4 4 4-4" />
      </svg>
    );
  }
  return (
    <svg className={`ml-1 inline h-3.5 w-3.5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {dir === "asc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      )}
    </svg>
  );
}

export default function ModelRepresentativesPage() {
  const canWrite = useCanWrite();
  const router = useRouter();
  const [alumni, setAlumni] = useState<ModelRepresentative[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterField, setFilterField] = useState<"all" | "name" | "studentId" | "generation" | "cohort">("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pages, setPages] = useState<Record<string, number>>({});
  const [viewSortFields, setViewSortFields] = useState<Record<string, ViewSortField>>({});
  const [viewSortDirs, setViewSortDirs] = useState<Record<string, SortDir>>({});

  const [mgmtSortField, setMgmtSortField] = useState<MgmtSortField>("generation");
  const [mgmtSortDir, setMgmtSortDir] = useState<SortDir>("asc");

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
  const [managePage, setManagePage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [alumniResults, setAlumniResults] = useState<{ id: string; studentId: string; prefix: string; firstName: string; maidenLastName: string }[]>([]);
  const [showAlumniDropdown, setShowAlumniDropdown] = useState(false);
  const [searchField, setSearchField] = useState<"studentId" | "name" | null>(null);
  const [showCohortDropdown, setShowCohortDropdown] = useState(false);
  const cohortDropdownRef = useRef<HTMLDivElement>(null);

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

  const alumniDisplayName = (a: { prefix: string; firstName: string; maidenLastName: string }) =>
    `${a.prefix}${a.firstName} ${a.maidenLastName}`;

  const selectAlumni = (a: { id: string; studentId: string; prefix: string; firstName: string; maidenLastName: string }) => {
    setForm((f) => ({ ...f, studentId: a.studentId, name: alumniDisplayName(a) }));
    setShowAlumniDropdown(false);
    setAlumniResults([]);
    setSearchField(null);
  };

  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !(prev[label] ?? true) }));

  const getPage = (label: string) => pages[label] ?? 1;
  const setPage = (label: string, p: number) =>
    setPages((prev) => ({ ...prev, [label]: p }));

  const getViewSortField = (label: string) => viewSortFields[label] ?? "generation";
  const getViewSortDir = (label: string) => viewSortDirs[label] ?? "asc";
  const handleViewSort = (label: string, field: ViewSortField) => {
    const currentField = viewSortFields[label] ?? "generation";
    const currentDir = viewSortDirs[label] ?? "asc";
    if (currentField === field) {
      setViewSortDirs((prev) => ({ ...prev, [label]: currentDir === "asc" ? "desc" : "asc" }));
    } else {
      setViewSortFields((prev) => ({ ...prev, [label]: field }));
      setViewSortDirs((prev) => ({ ...prev, [label]: "asc" }));
    }
  };

  const handleMgmtSort = (field: MgmtSortField) => {
    if (mgmtSortField === field) {
      setMgmtSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setMgmtSortField(field);
      setMgmtSortDir("asc");
    }
  };

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/model-representatives`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setAlumni(data.data);
      setPages({});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cohortDropdownRef.current && !cohortDropdownRef.current.contains(e.target as Node)) {
        setShowCohortDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const matchesSearch = useCallback((a: ModelRepresentative, term: string) => {
    if (!term) return true;
    const t = term.toLowerCase();
    switch (filterField) {
      case "name":
        return a.name.toLowerCase().includes(t);
      case "studentId":
        return a.studentId.toLowerCase().includes(t);
      case "generation":
        return String(a.generation).includes(t);
      case "cohort":
        return a.cohort.toLowerCase().includes(t);
      default:
        return (
          a.name.toLowerCase().includes(t) ||
          a.studentId.toLowerCase().includes(t) ||
          String(a.generation).includes(t) ||
          a.cohort.toLowerCase().includes(t)
        );
    }
  }, [filterField]);

  const grouped = useMemo(() => {
    const filtered = search
      ? alumni.filter((a) => matchesSearch(a, search))
      : alumni;

    const byCohort = new Map<string, ModelRepresentative[]>();
    for (const a of filtered) {
      const list = byCohort.get(a.cohort) || [];
      list.push(a);
      byCohort.set(a.cohort, list);
    }

    const sorted = [...byCohort.entries()].sort(([a], [b]) => {
      const ai = COHORT_ORDER.indexOf(a);
      const bi = COHORT_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    return sorted.map(([cohort, items]) => ({
      label: cohort,
      items: [...items].sort((a, b) => a.generation - b.generation),
    }));
  }, [alumni, search, matchesSearch]);

  const allCohorts = useMemo(() => {
    const seen = new Set(COHORT_ORDER);
    const result = [...COHORT_ORDER];
    for (const a of alumni) {
      if (!seen.has(a.cohort)) {
        seen.add(a.cohort);
        result.push(a.cohort);
      }
    }
    return result;
  }, [alumni]);

  const cohortOptions = useMemo(() => {
    if (!form.cohort.trim()) return allCohorts;
    const term = form.cohort.toLowerCase();
    return allCohorts.filter((c) => c.toLowerCase().includes(term));
  }, [allCohorts, form.cohort]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: ModelRepresentative) => {
    setForm({
      studentId: item.studentId,
      name: item.name,
      cohort: item.cohort,
      generation: String(item.generation),
    });
    setFormErrors({});
    setEditingId(item.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowCohortDropdown(false);
    setSearchField(null);
    setAlumniResults([]);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.studentId.trim()) errors.studentId = "กรุณากรอกรหัสนักศึกษา";
    if (!form.name.trim()) errors.name = "กรุณากรอกชื่อ-นามสกุล";
    if (!form.cohort.trim()) errors.cohort = "กรุณากรอกชื่อเครือข่าย";
    if (!form.generation) errors.generation = "กรุณากรอกรุ่นที่";
    if (form.generation && isNaN(Number(form.generation)))
      errors.generation = "รุ่นที่ต้องเป็นตัวเลข";
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
        cohort: form.cohort.trim(),
        generation: Number(form.generation),
      };
      if (editingId) {
        const res = await fetch(`/api/model-representatives/${editingId}`, {
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
          const res = await fetch("/api/model-representatives", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "เกิดข้อผิดพลาด");
          }
        } else {
          const params = new URLSearchParams({ section: "modelReps", nameSearch: form.name });
          if (form.cohort) params.set("cohort", form.cohort);
          if (form.generation) params.set("generation", form.generation);
          router.push(`/new-alumni?${params.toString()}`);
          return;
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
      const res = await fetch(`/api/model-representatives/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchAlumni();
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
      const res = await fetch("/api/model-representatives/bulk-delete", {
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
      fetchAlumni();
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
      const res = await fetch("/api/model-representatives/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("เกิดข้อผิดพลาด");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "model_representatives_export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      deselectAll();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการส่งออกข้อมูล");
    }
  };

  const filteredAlumni = useMemo(() => {
    const filtered = search ? alumni.filter((a) => matchesSearch(a, search)) : alumni;
    return [...filtered].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (mgmtSortField) {
        case "generation": va = a.generation; vb = b.generation; break;
        case "studentId": va = a.studentId; vb = b.studentId; break;
        case "cohort": va = a.cohort; vb = b.cohort; break;
        case "name": va = a.name; vb = b.name; break;
      }
      const cmp = typeof va === "number"
        ? (va as number) - (vb as number)
        : String(va).localeCompare(String(vb), "th");
      return mgmtSortDir === "asc" ? cmp : -cmp;
    });
  }, [alumni, search, matchesSearch, mgmtSortField, mgmtSortDir]);

  const manageTotalPages = Math.max(1, Math.ceil(filteredAlumni.length / PAGE_SIZE));
  const currentManagePage = Math.min(managePage, manageTotalPages);
  const manageStart = (currentManagePage - 1) * PAGE_SIZE;
  const managePageItems = filteredAlumni.slice(manageStart, manageStart + PAGE_SIZE);
  const managePageStart = filteredAlumni.length === 0 ? 0 : manageStart + 1;
  const managePageEnd = Math.min(manageStart + PAGE_SIZE, filteredAlumni.length);

  const handleExport = () => {
    window.location.href = "/api/model-representatives/export";
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/model-representatives/import", { method: "POST", body: formData });
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

  const managePaginationNumbers = (() => {
    const nums: (number | "...")[] = [];
    if (manageTotalPages <= 7) {
      for (let i = 1; i <= manageTotalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (currentManagePage > 3) nums.push("...");
      const start = Math.max(2, currentManagePage - 1);
      const end = Math.min(manageTotalPages - 1, currentManagePage + 1);
      for (let i = start; i <= end; i++) nums.push(i);
      if (currentManagePage < manageTotalPages - 2) nums.push("...");
      nums.push(manageTotalPages);
    }
    return nums;
  })();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          รายชื่อเครือข่ายศิษย์เก่าทุกรุ่นทุกหลักสูตร
        </h1>
        {!manageMode ? (
          canWrite && (
          <button
            onClick={() => { setManageMode(true); deselectAll(); }}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            จัดการข้อมูล
          </button>
          )
        ) : (
          <button
            onClick={() => {
              setManageMode(false);
              setShowForm(false);
              deselectAll();
            }}
            className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50"
          >
            กลับหน้าเดิม
          </button>
        )}
      </div>

      {/* Error toast */}
      {errorMsg && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg("")}
            className="ml-4 font-bold text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Import result */}
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

      {/* Manage mode: create/edit form */}
      {manageMode && showForm && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">
            {editingId ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {editingId ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    รหัสนักศึกษา *
                  </label>
                  <input
                    type="text"
                    value={form.studentId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, studentId: e.target.value }))
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.studentId ? "border-red-400" : "border-gray-300"}`}
                  />
                  {formErrors.studentId && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.studentId}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    ชื่อ-นามสกุล *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.name ? "border-red-400" : "border-gray-300"}`}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    รหัสนักศึกษา *
                  </label>
                  <input
                    type="text"
                    value={form.studentId}
                    onChange={(e) => { setForm((f) => ({ ...f, studentId: e.target.value, name: "" })); searchAlumni(e.target.value); setSearchField("studentId"); }}
                    placeholder="พิมพ์รหัสนักศึกษา..."
                    className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.studentId ? "border-red-400" : "border-gray-300"}`}
                  />
                  {formErrors.studentId && <p className="mt-1 text-xs text-red-500">{formErrors.studentId}</p>}
                  {showAlumniDropdown && searchField === "studentId" && alumniResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                      {alumniResults.map((a) => (
                        <button key={a.id} type="button" onClick={() => selectAlumni(a)} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors">
                          {a.studentId} - {alumniDisplayName(a)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    ชื่อ-นามสกุล *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value, studentId: "" })); searchAlumni(e.target.value); setSearchField("name"); }}
                    placeholder="พิมพ์ชื่อเพื่อค้นหาศิษย์เก่า..."
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.name ? "border-red-400" : "border-gray-300"}`}
                  />
                  {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
                  {showAlumniDropdown && searchField === "name" && alumniResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                      {alumniResults.map((a) => (
                        <button key={a.id} type="button" onClick={() => selectAlumni(a)} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors">
                          {a.studentId} - {alumniDisplayName(a)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="relative" ref={cohortDropdownRef}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ชื่อเครือข่าย *
              </label>
              <input
                type="text"
                value={form.cohort}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cohort: e.target.value }))
                }
                onFocus={() => setShowCohortDropdown(true)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.cohort ? "border-red-400" : "border-gray-300"}`}
              />
              {formErrors.cohort && (
                <p className="mt-1 text-xs text-red-500">{formErrors.cohort}</p>
              )}
              {showCohortDropdown && cohortOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {cohortOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, cohort: c }));
                        setShowCohortDropdown(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                รุ่นที่ *
              </label>
              <input
                type="number"
                value={form.generation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, generation: e.target.value }))
                }
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.generation ? "border-red-400" : "border-gray-300"}`}
              />
              {formErrors.generation && (
                <p className="mt-1 text-xs text-red-500">
                  {formErrors.generation}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={closeForm}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {/* Manage mode: add button */}
      {manageMode && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
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
          value={filterField}
          onChange={(e) => setFilterField(e.target.value as typeof filterField)}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        >
          <option value="all">ทั้งหมด</option>
          <option value="name">ชื่อ-นามสกุล</option>
          <option value="studentId">รหัสนักศึกษา</option>
          <option value="generation">รุ่นที่</option>
          <option value="cohort">ชื่อเครือข่าย</option>
        </select>
        <input
          type="text"
          placeholder="ค้นหา..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (manageMode) setManagePage(1);
          }}
          className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] sm:max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : manageMode ? (
        /* ===== MANAGE MODE: flat table ===== */
        filteredAlumni.length === 0 ? (
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
                        checked={managePageItems.length > 0 && isAllSelected(managePageItems.map((item) => item.id))}
                        onChange={(e) => {
                          if (e.target.checked) selectAll(managePageItems.map((item) => item.id));
                          else deselectAll();
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th onClick={() => handleMgmtSort("generation")} className="cursor-pointer select-none px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10">
                    รุ่นที่ <SortIcon active={mgmtSortField === "generation"} dir={mgmtSortDir} />
                  </th>
                  <th onClick={() => handleMgmtSort("studentId")} className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10">
                    รหัสนักศึกษา <SortIcon active={mgmtSortField === "studentId"} dir={mgmtSortDir} />
                  </th>
                  <th onClick={() => handleMgmtSort("cohort")} className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10">
                    ชื่อเครือข่าย <SortIcon active={mgmtSortField === "cohort"} dir={mgmtSortDir} />
                  </th>
                  <th onClick={() => handleMgmtSort("name")} className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10">
                    ชื่อ-นามสกุล <SortIcon active={mgmtSortField === "name"} dir={mgmtSortDir} />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {managePageItems.map((a, i) => (
                  <tr
                    key={a.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    {manageMode && (
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-center text-gray-500">
                      {a.generation}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{a.studentId}</td>
                    <td className="px-4 py-3">{a.cohort}</td>
                    <td className="px-4 py-3">{a.name}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(a)}
                          className="rounded p-1.5 text-blue-600 hover:bg-blue-100"
                          title="แก้ไข"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteId(a.id)}
                          className="rounded p-1.5 text-red-500 hover:bg-red-100"
                          title="ลบ"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row">
              <span className="text-sm text-gray-500">
                แสดง {managePageStart}-{managePageEnd} จาก {filteredAlumni.length}{" "}
                รายการ
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setManagePage(Math.max(1, currentManagePage - 1)); deselectAll(); }}
                  disabled={currentManagePage === 1}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                >
                  ก่อนหน้า
                </button>
                {managePaginationNumbers.map((p, i) =>
                  p === "..." ? (
                    <span
                      key={`dot-${i}`}
                      className="px-2 text-gray-400"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => { setManagePage(p); deselectAll(); }}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                        currentManagePage === p
                          ? "bg-[var(--primary)] text-white"
                          : "text-gray-600 bg-white hover:bg-gray-100"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => {
                    setManagePage(Math.min(manageTotalPages, currentManagePage + 1));
                    deselectAll();
                  }}
                  disabled={currentManagePage === manageTotalPages}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          </div>
        )
      ) : /* ===== VIEW MODE: sectioned tables by cohort ===== */
      grouped.length === 0 ? (
        <div className="py-12 text-center text-[var(--muted)]">ไม่พบข้อมูล</div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => {
            const isCollapsed = collapsed[group.label] ?? true;
            const sortField = getViewSortField(group.label);
            const sortDir = getViewSortDir(group.label);
            const sortedItems = [...group.items].sort((a, b) => {
              let va: string | number, vb: string | number;
              switch (sortField) {
                case "generation": va = a.generation; vb = b.generation; break;
                case "studentId": va = a.studentId; vb = b.studentId; break;
                case "name": va = a.name; vb = b.name; break;
              }
              const cmp = typeof va === "number"
                ? (va as number) - (vb as number)
                : String(va).localeCompare(String(vb), "th");
              return sortDir === "asc" ? cmp : -cmp;
            });
            const totalPages = Math.max(
              1,
              Math.ceil(sortedItems.length / PAGE_SIZE)
            );
            const currentPage = Math.min(getPage(group.label), totalPages);
            const start = (currentPage - 1) * PAGE_SIZE;
            const pageItems = sortedItems.slice(start, start + PAGE_SIZE);

            return (
              <div
                key={group.label}
                className="overflow-hidden rounded-lg bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggle(group.label)}
                  className="flex w-full items-center justify-between bg-[var(--primary)] px-4 py-3 text-left"
                >
                  <h2 className="text-sm font-semibold text-white sm:text-base">
                    {group.label}
                  </h2>
                  <svg
                    className={`h-5 w-5 shrink-0 text-white transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {!isCollapsed && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr
                            className="text-white text-left"
                            style={{ backgroundColor: "#1e3a5f" }}
                          >
                            <th
                              className="w-20 cursor-pointer px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap select-none hover:bg-white/10"
                              onClick={() => handleViewSort(group.label, "generation")}
                            >
                              รุ่นที่ <SortIcon active={sortField === "generation"} dir={sortDir} />
                            </th>
                            <th
                              className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap select-none hover:bg-white/10"
                              onClick={() => handleViewSort(group.label, "studentId")}
                            >
                              รหัสนักศึกษา <SortIcon active={sortField === "studentId"} dir={sortDir} />
                            </th>
                            <th
                              className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap select-none hover:bg-white/10"
                              onClick={() => handleViewSort(group.label, "name")}
                            >
                              ชื่อ - นามสกุล <SortIcon active={sortField === "name"} dir={sortDir} />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map((a) => (
                            <tr
                              key={a.id}
                              className="border-b border-[var(--border)] transition-colors hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-center">
                                {a.generation}
                              </td>
                              <td className="px-4 py-3 font-mono text-sm">{a.studentId}</td>
                              <td className="px-4 py-3">{a.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
                        <span className="text-sm text-gray-500">แสดง {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, sortedItems.length)} จาก {sortedItems.length} รายการ</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              setPage(group.label, Math.max(1, currentPage - 1))
                            }
                            disabled={currentPage === 1}
                            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
                          >
                            ก่อนหน้า
                          </button>
                          {Array.from(
                            { length: totalPages },
                            (_, i) => i + 1
                          ).map((p) => (
                            <button
                              key={p}
                              onClick={() => setPage(group.label, p)}
                              className={`rounded-md px-3 py-1.5 text-sm ${
                                p === currentPage
                                  ? "bg-[var(--primary)] text-white"
                                  : "border border-[var(--border)] bg-white hover:bg-gray-100"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            onClick={() =>
                              setPage(
                                group.label,
                                Math.min(totalPages, currentPage + 1)
                              )
                            }
                            disabled={currentPage === totalPages}
                            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
                          >
                            ถัดไป
                          </button>
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

      {/* Delete confirmation dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              ยืนยันการลบข้อมูล
            </h3>
            <p className="mb-6 text-sm text-gray-600">
              คุณต้องการลบข้อมูลนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation dialog */}
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

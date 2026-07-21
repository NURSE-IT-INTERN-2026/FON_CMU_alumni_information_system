"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { PAGE_SIZE, BASE_PATH, MODEL_REP_NETWORKS as NETWORK_ORDER } from "@/lib/constants";
import OrangeCell from "@/components/OrangeCell";
import { ExportRangeButton } from "@/components/ExportRangeButton";
import { useHotFields } from "@/lib/use-hot-fields";
import { useBulkSelection } from "@/lib/useBulkSelection";
import { useAlumniSearch } from "@/lib/useAlumniSearch";
import { facetQueryParams } from "@/lib/filter-facets";
import FacetFilter from "@/components/ui/facet-filter";
import SearchInput from "@/components/ui/search-input";
import { modelRepPageFormSchema, type ModelRepPageFormData } from "@/lib/validations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import { useCanWrite } from "@/lib/role-context";

interface ModelRepresentative {
  id: string;
  studentId: string | null;
  // "No Alumni to link to" flag — display the effective id as `studentId ?? pendingStudentId`.
  pendingStudentId: string | null;
  prefix: string | null;
  firstName: string;
  lastName: string;
  cohort: string;
  generation: number;
  major?: string | null;
}

type SortField = "network" | "generation" | "studentId" | "prefix" | "firstName" | "lastName" | "major";
type SortDir = "asc" | "desc";

type FormValues = ModelRepPageFormData & { studentId: string; major: string };

const nameDisplay = (a: { prefix?: string | null; firstName?: string | null; lastName?: string | null }) =>
  [a.prefix, a.firstName, a.lastName].filter(Boolean).join(" ").trim() || "-";

const DEFAULT_FORM_VALUES: FormValues = { studentId: "", major: "", prefix: "", firstName: "", lastName: "", cohort: "", generation: "" };

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

function compareNetwork(a: string, b: string): number {
  const ai = NETWORK_ORDER.indexOf(a);
  const bi = NETWORK_ORDER.indexOf(b);
  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
}

export default function ModelRepresentativesPage() {
  const router = useRouter();
  const canWrite = useCanWrite();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const filtersKey = facetQueryParams(filters).toString();
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);

  const qc = useQueryClient();
  const { data: alumniData, isPending: loading, isError } = useQuery({
    queryKey: ["modelRepresentatives", "list", { filtersKey, ...(unlinkedOnly ? { unlinked: true } : {}) }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (unlinkedOnly) params.set("unlinked", "true");
      facetQueryParams(filters).forEach((v, k) => params.set(k, v));
      return apiFetch<{ data: ModelRepresentative[] }>(`/api/model-representatives${params.toString() ? `?${params}` : ""}`);
    },
  });
  // Wrap in useMemo so the array identity is stable across renders (avoids
  // re-running the sort memos below on every render — react-hooks/exhaustive-deps).
  const alumni = useMemo(() => alumniData?.data ?? [], [alumniData]);

  const [mgmtSortField, setMgmtSortField] = useState<SortField>("network");
  const [mgmtSortDir, setMgmtSortDir] = useState<SortDir>("asc");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors }, reset: formReset, control, getValues, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(modelRepPageFormSchema) as unknown as Resolver<FormValues>,
    defaultValues: DEFAULT_FORM_VALUES,
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const {
    selectedCount,
    toggleSelect,
    selectAll,
    deselectAll,
    deselectPage,
    isSelected,
    isAllSelected,
    getSelectedArray,
  } = useBulkSelection();
  const [selectMode, setSelectMode] = useState(false);
  const enterSelect = () => setSelectMode(true);
  const exitSelect = () => { setSelectMode(false); deselectAll(); };
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [managePage, setManagePage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; pending?: number; warnings?: { row: number; message: string }[]; errors: { row: number; message: string }[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const { alumniResults, showAlumniDropdown, searchAlumni, clearResults, displayName } = useAlumniSearch();
  const [searchField, setSearchField] = useState<"studentId" | "name" | null>(null);
  const [nameSearch, setNameSearch] = useState("");
  const [showCohortDropdown, setShowCohortDropdown] = useState(false);
  const cohortDropdownRef = useRef<HTMLDivElement>(null);

  const selectAlumni = (a: { id: string; studentId: string; prefix: string; firstName: string; lastName: string; major?: string }) => {
    setValue("studentId", a.studentId);
    setValue("prefix", a.prefix ?? "");
    setValue("firstName", a.firstName ?? "");
    setValue("lastName", a.lastName ?? "");
    setValue("major", a.major ?? "");
    setNameSearch(displayName(a));
    clearResults();
    setSearchField(null);
  };

  const handleSort = (field: SortField) => {
    if (mgmtSortField === field) {
      setMgmtSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setMgmtSortField(field);
      setMgmtSortDir("asc");
    }
  };

  const sortItems = useCallback((items: ModelRepresentative[], field: SortField, dir: SortDir) => {
    return [...items].sort((a, b) => {
      let cmp: number;
      switch (field) {
        case "network":
          cmp = compareNetwork(a.cohort, b.cohort);
          if (cmp !== 0) break;
          // Secondary sort by generation
          cmp = a.generation - b.generation;
          break;
        case "generation":
          cmp = a.generation - b.generation;
          break;
        case "studentId":
          cmp = (a.studentId || a.pendingStudentId || "").localeCompare(b.studentId || b.pendingStudentId || "", "th");
          break;
        case "prefix":
          cmp = (a.prefix ?? "").localeCompare(b.prefix ?? "", "th");
          break;
        case "firstName":
          cmp = a.firstName.localeCompare(b.firstName, "th");
          break;
        case "lastName":
          cmp = a.lastName.localeCompare(b.lastName, "th");
          break;
        case "major":
          cmp = (a.major ?? "").localeCompare(b.major ?? "", "th");
          break;
        default:
          cmp = 0;
      }
      return dir === "asc" ? cmp : -cmp;
    });
  }, []);

  const setFilter = (field: string, vals: string[]) => {
    setFilters((prev) => ({ ...prev, [field]: vals }));
    setManagePage(1);
  };

  const applySearch = (value: string) => {
    setSearch(value);
    setManagePage(1);
  };

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
    const fullName = [a.prefix, a.firstName, a.lastName].filter(Boolean).join(" ").toLowerCase();
    // Search all fields (name, effective student id, generation, network).
    return (
      fullName.includes(t) ||
      (a.studentId || a.pendingStudentId || "").toLowerCase().includes(t) ||
      String(a.generation).includes(t) ||
      a.cohort.toLowerCase().includes(t)
    );
  }, []);

  const filteredAlumni = useMemo(() => {
    return search ? alumni.filter((a) => matchesSearch(a, search)) : alumni;
  }, [alumni, search, matchesSearch]);

  const mgmtSorted = useMemo(() => {
    return sortItems(filteredAlumni, mgmtSortField, mgmtSortDir);
  }, [filteredAlumni, mgmtSortField, mgmtSortDir, sortItems]);

  const allCohorts = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    // Put known networks first in order
    for (const n of NETWORK_ORDER) {
      seen.add(n);
      result.push(n);
    }
    for (const a of alumni) {
      if (!seen.has(a.cohort)) {
        seen.add(a.cohort);
        result.push(a.cohort);
      }
    }
    return result;
  }, [alumni]);

  // react-hook-form's `watch()` reactively filters the cohort dropdown as the
  // user types, which opts this component out of the React Compiler (benign —
  // it still works, just isn't compiler-optimized).
  // eslint-disable-next-line react-hooks/incompatible-library
  const cohortValue = watch("cohort");
  const cohortOptions = useMemo(() => {
    if (!cohortValue?.trim()) return allCohorts;
    const term = cohortValue.toLowerCase();
    return allCohorts.filter((c) => c.toLowerCase().includes(term));
  }, [allCohorts, cohortValue]);

  const openCreate = () => {
    formReset(DEFAULT_FORM_VALUES);
    setNameSearch("");
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: ModelRepresentative) => {
    formReset({
      studentId: item.studentId ?? "",
      prefix: item.prefix ?? "",
      firstName: item.firstName,
      lastName: item.lastName,
      major: item.major || "",
      cohort: item.cohort,
      generation: String(item.generation),
    });
    setNameSearch("");
    setEditingId(item.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    formReset(DEFAULT_FORM_VALUES);
    setNameSearch("");
    setShowCohortDropdown(false);
    setSearchField(null);
    clearResults();
  };

  const onSave = async (data: ModelRepPageFormData) => {
    const studentId = getValues("studentId");
    setErrorMsg("");
    setSaving(true);
    try {
      const payload = {
        studentId: studentId.trim(),
        major: getValues("major")?.trim() || null,
        ...data,
        cohort: data.cohort.trim(),
        generation: Number(data.generation),
      };
      if (editingId) {
        await apiFetch(`/api/model-representatives/${editingId}`, { method: "PUT", json: payload });
      } else {
        if (studentId) {
          await apiFetch(`/api/model-representatives`, { method: "POST", json: payload });
        } else {
          const params = new URLSearchParams({ section: "modelReps", nameSearch: nameDisplay(data) });
          if (data.cohort) params.set("cohort", data.cohort);
          if (data.generation) params.set("generation", data.generation);
          router.push(`/management/new-alumni?${params.toString()}`);
          return;
        }
      }
      closeForm();
      qc.invalidateQueries({ queryKey: queryKeys.modelRepresentatives.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/api/model-representatives/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: queryKeys.modelRepresentatives.all });
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
      await apiFetch(`/api/model-representatives/bulk-delete`, { method: "POST", json: { ids } });
      deselectAll();
      setShowBulkDeleteDialog(false);
      qc.invalidateQueries({ queryKey: queryKeys.modelRepresentatives.all });
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
      const res = await fetch(`${BASE_PATH}/api/model-representatives/export`, {
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

  // ── Manage mode pagination ──
  const manageTotalPages = Math.max(1, Math.ceil(mgmtSorted.length / PAGE_SIZE));
  const currentManagePage = Math.min(managePage, manageTotalPages);
  const manageStart = (currentManagePage - 1) * PAGE_SIZE;
  const managePageItems = mgmtSorted.slice(manageStart, manageStart + PAGE_SIZE);
  const hot = useHotFields("model_representative", managePageItems.map((a) => a.id));
  const managePageStart = mgmtSorted.length === 0 ? 0 : manageStart + 1;
  const managePageEnd = Math.min(manageStart + PAGE_SIZE, mgmtSorted.length);

  const buildExportHref = (startRow: number | null, endRow: number | null) => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (startRow != null) params.set("startRow", String(startRow));
    if (endRow != null) params.set("endRow", String(endRow));
    return `${BASE_PATH}/api/model-representatives/export?${params}`;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiFetch<{ imported: number; updated: number; pending?: number; warnings?: { row: number; message: string }[]; errors: { row: number; message: string }[] }>(
        `/api/model-representatives/import`,
        { method: "POST", body: formData },
      );
      setImportResult(data);
      qc.invalidateQueries({ queryKey: queryKeys.modelRepresentatives.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้า");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  const paginationNumbers = (totalPages: number, currentPage: number) => {
    const nums: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (currentPage > 3) nums.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) nums.push(i);
      if (currentPage < totalPages - 2) nums.push("...");
      nums.push(totalPages);
    }
    return nums;
  };

  const renderPagination = (
    totalPages: number,
    currentPage: number,
    onPageChange: (p: number) => void,
    pageStart: number,
    pageEnd: number,
    totalItems: number,
  ) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row">
        <span className="text-sm text-gray-500">
          แสดง {pageStart}-{pageEnd} จาก {totalItems} รายการ
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ก่อนหน้า
          </button>
          {paginationNumbers(totalPages, currentPage).map((p, i) =>
            p === "..." ? (
              <span key={`dot-${i}`} className="px-2 text-gray-400">...</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  currentPage === p
                    ? "bg-[var(--primary)] text-white"
                    : "text-gray-600 bg-white hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ถัดไป
          </button>
        </div>
      </div>
    );
  };

  const tableHeader = (field: SortField, label: string, align: "left" | "center" = "left") => (
    <th
      onClick={() => handleSort(field)}
      className={`cursor-pointer select-none px-4 py-3 text-${align} text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10`}
    >
      {label}{" "}
      <SortIcon
        active={mgmtSortField === field}
        dir={mgmtSortDir}
      />
    </th>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          รายชื่อเครือข่ายศิษย์เก่าทุกรุ่นทุกหลักสูตร
        </h1>
        {canWrite && (selectMode ? (
          <div className="flex items-center gap-2">
            <button onClick={() => (isAllSelected(managePageItems.map((i) => i.id)) ? deselectPage(managePageItems.map((i) => i.id)) : selectAll(managePageItems.map((i) => i.id)))} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50">
              {isAllSelected(managePageItems.map((i) => i.id)) ? "ยกเลิกเลือกหน้านี้" : "เลือกทั้งหมดในหน้านี้"}
            </button>
            <button onClick={exitSelect} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
              เสร็จสิ้น
            </button>
          </div>
        ) : (
          <button onClick={enterSelect} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            เลือก
          </button>
        ))}
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
            <span>นำเข้าสำเร็จ {importResult.imported} รายการ{importResult.updated > 0 && ` (อัปเดต ${importResult.updated} รายการ)`}{importResult.pending && importResult.pending > 0 ? ` (รอเชื่อมโยง ${importResult.pending} รายการ — ไม่มีข้อมูลศิษย์เก่า)` : ""}</span>
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
      {showForm && canWrite && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">
            {editingId ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {editingId ? (
              <>
                <FormField label="รหัสนักศึกษา" required>
                  <FormInput registration={register("studentId")} type="text" className="font-mono" />
                </FormField>
                <FormField label="คำนำหน้า">
                  <FormInput registration={register("prefix")} type="text" placeholder="เช่น นาย, นางสาว, ดร." />
                </FormField>
                <FormField label="ชื่อ" required error={errors.firstName?.message}>
                  <FormInput registration={register("firstName")} error={errors.firstName?.message} type="text" />
                </FormField>
                <FormField label="นามสกุล" required error={errors.lastName?.message}>
                  <FormInput registration={register("lastName")} error={errors.lastName?.message} type="text" />
                </FormField>
              </>
            ) : (
              <>
                <div className="relative">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    รหัสนักศึกษา *
                  </label>
                  <Controller
                    name="studentId"
                    control={control}
                    render={({ field }) => (
                      <>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => { field.onChange(e.target.value); setValue("prefix", ""); setValue("firstName", ""); setValue("lastName", ""); setNameSearch(""); searchAlumni(e.target.value); setSearchField("studentId"); }}
                          placeholder="พิมพ์รหัสนักศึกษา..."
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                        {showAlumniDropdown && searchField === "studentId" && alumniResults.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                            {alumniResults.map((a) => (
                              <button key={a.id} type="button" onClick={() => selectAlumni(a)} className="block w-full px-3 py-2 text-left text-sm hover:bg-purple-50 transition-colors">
                                {a.studentId} - {displayName(a)}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  />
                </div>
                <div className="relative">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    ชื่อ-นามสกุล *
                  </label>
                  <input
                    type="text"
                    value={nameSearch}
                    onChange={(e) => { setNameSearch(e.target.value); setValue("studentId", ""); setValue("prefix", ""); setValue("firstName", ""); setValue("lastName", ""); searchAlumni(e.target.value); setSearchField("name"); }}
                    placeholder="พิมพ์ชื่อเพื่อค้นหาศิษย์เก่า..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  {showAlumniDropdown && searchField === "name" && alumniResults.length > 0 && (
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
            <div className="relative" ref={cohortDropdownRef}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                เครือข่าย *
              </label>
              <Controller name="cohort" control={control} render={({ field }) => (
                <>
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onFocus={() => setShowCohortDropdown(true)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${errors.cohort ? "border-red-400" : "border-gray-300"}`}
                  />
                  {showCohortDropdown && cohortOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                      {cohortOptions.map((c) => (
                        <button key={c} type="button" onClick={() => { field.onChange(c); setShowCohortDropdown(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-purple-50 transition-colors">
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )} />
              {errors.cohort && (
                <p className="mt-1 text-xs text-red-500">{errors.cohort.message}</p>
              )}
            </div>
            <FormField label="รุ่นที่" required error={errors.generation?.message}>
              <FormInput registration={register("generation")} error={errors.generation?.message} type="number" />
            </FormField>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={closeForm}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSubmit(onSave)}
              disabled={saving}
              className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {/* Manage mode: action buttons */}
      {(
        <div className="mb-4 flex flex-wrap gap-2">
          {canWrite && (
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
          )}
          <ExportRangeButton buildHref={buildExportHref} />
          {canWrite && (
            <>
              <input type="file" accept=".xlsx,.xls" ref={importFileRef} onChange={handleImport} className="hidden" />
              <button onClick={() => importFileRef.current?.click()} disabled={importing} className="inline-flex items-center gap-1.5 rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-600 hover:text-white transition-colors disabled:opacity-50">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m16.5-12L12 7.5m0 0L7.5 4.5M12 7.5V21" /></svg>
                {importing ? "กำลังนำเข้า..." : "นำเข้า Excel"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setUnlinkedOnly((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${unlinkedOnly ? "border-amber-500 bg-amber-100 text-amber-700" : "border-[var(--border)] bg-white text-[var(--muted)] hover:bg-gray-50"}`}
            title="แสดงเฉพาะรายการที่ยังไม่มีข้อมูลศิษย์เก่าให้เชื่อมโยง"
          >
            รอเชื่อมโยง
          </button>
          {selectedCount > 0 && (
            <>
              {canWrite && (
                <button
                  onClick={() => setShowBulkDeleteDialog(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  ลบที่เลือก ({selectedCount})
                </button>
              )}
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
        <SearchInput
          value={search}
          onSearch={applySearch}
          placeholder="ค้นหา..."
          formClassName="w-full sm:max-w-md"
        />
      </div>

      {/* Facet filters */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FacetFilter entity="model-representatives" field="cohort" label="เครือข่าย" selected={filters.cohort ?? []} onChange={(v) => setFilter("cohort", v)} />
        <FacetFilter entity="model-representatives" field="generation" label="รุ่นที่" selected={filters.generation ?? []} onChange={(v) => setFilter("generation", v)} />
        <FacetFilter entity="model-representatives" field="major" label="สาขาวิชา" selected={filters.major ?? []} onChange={(v) => setFilter("major", v)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="flex justify-center py-16 text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</div>
      ) : (
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
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                    ลำดับ
                  </th>
                  {tableHeader("network", "เครือข่าย")}
                  {tableHeader("generation", "รุ่นที่", "center")}
                  {tableHeader("studentId", "รหัสนักศึกษา")}
                  {tableHeader("major", "สาขาวิชา")}
                  {tableHeader("prefix", "คำนำหน้า")}
                  {tableHeader("firstName", "ชื่อ")}
                  {tableHeader("lastName", "นามสกุล")}
                  {canWrite && (
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      จัดการ
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {managePageItems.map((a, i) => (
                  <tr
                    key={a.id}
                    onClick={(e) => { if ((e.target as HTMLElement).closest("button, input, a")) return; if (selectMode) toggleSelect(a.id); else if (a.studentId) router.push(`/management/alumni/${a.studentId}`); }}
                    className={`cursor-pointer transition-colors ${isSelected(a.id) ? "bg-orange-100 hover:bg-orange-200" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-4 py-3 text-center text-gray-500">{manageStart + i + 1}</td>
                    <td className="px-4 py-3"><OrangeCell resourceType="model_representative" recordId={a.id} field="cohort" value={a.cohort} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      <OrangeCell resourceType="model_representative" recordId={a.id} field="generation" value={a.generation} hotFields={hot[a.id]} />
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {a.studentId || a.pendingStudentId || "-"}
                      {a.pendingStudentId && !a.studentId ? (
                        <span className="ml-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] text-amber-700" title="ไม่มีข้อมูลศิษย์เก่าให้เชื่อมโยง">รอเชื่อมโยง</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3"><OrangeCell resourceType="model_representative" recordId={a.id} field="major" value={a.major || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3">{a.prefix || "-"}</td>
                    <td className="px-4 py-3"><OrangeCell resourceType="model_representative" recordId={a.id} field="firstName" value={a.firstName} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3"><OrangeCell resourceType="model_representative" recordId={a.id} field="lastName" value={a.lastName} hotFields={hot[a.id]} /></td>
                    {canWrite && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(a)}
                            className="rounded p-1.5 text-purple-600 hover:bg-purple-100"
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
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {renderPagination(manageTotalPages, currentManagePage, (p) => { setManagePage(p); }, managePageStart, managePageEnd, mgmtSorted.length)}
          </div>
        )
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

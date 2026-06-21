"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCanWrite } from "@/lib/role-context";
import { PAGE_SIZE, BASE_PATH, EDIT_REASON_OPTIONS } from "@/lib/constants";
import OrangeCell from "@/components/OrangeCell";
import { useHotFields } from "@/lib/use-hot-fields";
import { useBulkSelection } from "@/lib/useBulkSelection";
import { useAlumniSearch } from "@/lib/useAlumniSearch";
import { facetQueryParams } from "@/lib/filter-facets";
import FacetFilter from "@/components/ui/facet-filter";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormTextarea from "@/components/form/FormTextarea";

interface AlumniAgency {
  id: string;
  studentId: string | null;
  cohort: string | null;
  prefix: string | null;
  firstName: string | null;
  lastName: string | null;
  englishName: string | null;
  workplace: string | null;
  homeAddress: string | null;
  country: string;
  major: string | null;
  notes: string | null;
  order: number;
}

interface ApiResponse {
  data: AlumniAgency[];
  countries: string[];
}

// Thailand mode (PRD §3.9) — read-only view sourced from the `alumni` table
interface ThailandAlumni {
  id: string;
  studentId: string | null;
  cohort: string | null;
  major: string | null;
  prefix: string | null;
  firstName: string | null;
  maidenLastName: string | null;
  newLastName: string | null;
  englishName: string | null;
  currentWorkplace: string | null;
  homeAddress: string | null;
  remarks: string | null;
}

interface ThailandApiResponse {
  data: ThailandAlumni[];
  total: number;
  page: number;
  pageSize: number;
}

type ThailandSortField =
  | "studentId"
  | "cohort"
  | "major"
  | "prefix"
  | "firstName"
  | "newLastName"
  | "englishName"
  | "currentWorkplace"
  | "homeAddress"
  | "remarks";
type ThailandSortDir = "asc" | "desc";

const THAILAND_SORT_FIELDS: { field: ThailandSortField; label: string }[] = [
  { field: "studentId", label: "รหัสนักศึกษา" },
  { field: "cohort", label: "รุ่น" },
  { field: "major", label: "สาขาวิชา" },
  { field: "prefix", label: "คำนำหน้า" },
  { field: "firstName", label: "ชื่อ" },
  { field: "newLastName", label: "นามสกุล" },
  { field: "englishName", label: "ชื่ออังกฤษ" },
  { field: "currentWorkplace", label: "สถานที่ทำงาน" },
  { field: "homeAddress", label: "ที่อยู่บ้าน" },
  { field: "remarks", label: "หมายเหตุ" },
];

type ThailandSearchField = "all" | "studentId" | "firstName" | "currentWorkplace";

const THAILAND_SEARCH_FIELDS: { value: ThailandSearchField; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "studentId", label: "รหัสนักศึกษา" },
  { value: "firstName", label: "ชื่อ" },
  { value: "currentWorkplace", label: "สถานที่ทำงาน" },
];

const abroadFormSchema = z.object({
  studentId: z.string(),
  cohort: z.string(),
  prefix: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  englishName: z.string(),
  workplace: z.string(),
  homeAddress: z.string(),
  country: z.string().min(1, "กรุณากรอกประเทศ"),
  major: z.string(),
  notes: z.string(),
  order: z.string(),
}).refine((data) => data.firstName.trim() || data.lastName.trim() || data.englishName.trim(), {
  message: "กรุณากรอกชื่อ-นามสกุล หรือชื่ออังกฤษ",
  path: ["firstName"],
});
type AbroadFormValues = z.infer<typeof abroadFormSchema>;

type SearchField = "all" | "firstName" | "lastName" | "englishName" | "country" | "workplace" | "homeAddress" | "cohort";

const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "firstName", label: "ชื่อ" },
  { value: "lastName", label: "นามสกุล" },
  { value: "englishName", label: "ชื่ออังกฤษ" },
  { value: "country", label: "ประเทศ" },
  { value: "workplace", label: "สถานที่ทำงาน" },
  { value: "homeAddress", label: "ที่อยู่บ้าน" },
  { value: "cohort", label: "รุ่น" },
];

function displayName(a: AlumniAgency): string {
  const thai = [a.firstName, a.lastName].filter(Boolean).join(" ").trim();
  if (thai && a.englishName) return `${thai} (${a.englishName})`;
  return thai || a.englishName || "-";
}

type SortField = "cohort" | "prefix" | "firstName" | "lastName" | "englishName" | "country" | "workplace" | "homeAddress" | "notes" | "order";
type SortDir = "asc" | "desc";

const MGMT_SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: "cohort", label: "รุ่น" },
  { field: "prefix", label: "คำนำหน้า" },
  { field: "firstName", label: "ชื่อ" },
  { field: "lastName", label: "นามสกุล" },
  { field: "englishName", label: "ชื่ออังกฤษ" },
  { field: "country", label: "ประเทศ" },
  { field: "workplace", label: "สถานที่ทำงาน" },
  { field: "homeAddress", label: "ที่อยู่บ้าน" },
  { field: "notes", label: "หมายเหตุ" },
];

const VIEW_SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: "cohort", label: "รุ่น" },
  { field: "prefix", label: "คำนำหน้า" },
  { field: "firstName", label: "ชื่อ" },
  { field: "lastName", label: "นามสกุล" },
  { field: "englishName", label: "ชื่ออังกฤษ" },
  { field: "country", label: "ประเทศ" },
  { field: "workplace", label: "สถานที่ทำงาน" },
  { field: "homeAddress", label: "ที่อยู่บ้าน" },
  { field: "notes", label: "หมายเหตุ" },
];

function getFieldValue(a: AlumniAgency, field: SortField): string {
  switch (field) {
    case "cohort": return a.cohort || "";
    case "prefix": return a.prefix || "";
    case "firstName": return a.firstName || "";
    case "lastName": return a.lastName || "";
    case "englishName": return a.englishName || "";
    case "country": return a.country;
    case "workplace": return a.workplace || "";
    case "homeAddress": return a.homeAddress || "";
    case "notes": return a.notes || "";
    case "order": return String(a.order);
  }
}

function getPageNumbers(current: number, total: number): (number | "dots")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "dots")[] = [1];
  if (current > 3) pages.push("dots");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("dots");
  if (pages[pages.length - 1] !== total) pages.push(total);
  return pages;
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

export default function AlumniAgencyPage() {
  const canWrite = useCanWrite();
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [countryFilter, setCountryFilter] = useState("");

  const [manageMode, setManageMode] = useState(false);
  const [mgmtPage, setMgmtPage] = useState(1);
  const [viewPage, setViewPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");
  const { register, handleSubmit, formState: { errors }, reset: formReset, control, setValue } = useForm<AbroadFormValues>({
    resolver: zodResolver(abroadFormSchema) as any,
    defaultValues: { studentId: "", cohort: "", prefix: "คุณ", firstName: "", lastName: "", englishName: "", workplace: "", homeAddress: "", country: "", major: "", notes: "", order: "0" },
  });
  const [formSearchField, setFormSearchField] = useState<"studentId" | "name" | null>(null);
  const [nameSearch, setNameSearch] = useState("");
  const { alumniResults, showAlumniDropdown, searchAlumni, clearResults, displayName } = useAlumniSearch();

  const selectAlumni = (a: { id: string; studentId: string; prefix: string; firstName: string; maidenLastName: string; major?: string }) => {
    setValue("studentId", a.studentId);
    setValue("major", a.major ?? "");
    setValue("prefix", a.prefix ?? "");
    setValue("firstName", a.firstName ?? "");
    setValue("lastName", a.maidenLastName ?? "");
    setNameSearch("");
    clearResults();
    setFormSearchField(null);
  };
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

  const [mgmtSortField, setMgmtSortField] = useState<SortField>("country");
  const [mgmtSortDir, setMgmtSortDir] = useState<SortDir>("desc");
  const [viewSortField, setViewSortField] = useState<SortField>("cohort");
  const [viewSortDir, setViewSortDir] = useState<SortDir>("desc");

  // Thailand mode (PRD §3.9) — read-only view sourced from the alumni table
  const [mode, setMode] = useState<"abroad" | "thailand">("abroad");
  const [thailandPage, setThailandPage] = useState(1);
  const [thailandSearch, setThailandSearch] = useState("");
  const [thailandSearchField, setThailandSearchField] = useState<ThailandSearchField>("all");
  const [thailandSortField, setThailandSortField] = useState<ThailandSortField>("studentId");
  const [thailandSortDir, setThailandSortDir] = useState<ThailandSortDir>("asc");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const filtersKey = facetQueryParams(filters).toString();

  const setFilter = (field: string, vals: string[]) => {
    setFilters((prev) => ({ ...prev, [field]: vals }));
    setThailandPage(1);
  };

  const { data: thailandData, isPending: thailandLoading } = useQuery({
    queryKey: ["alumniAgency", "thailand", { thailandPage, thailandSearch, thailandSearchField, thailandSortField, thailandSortDir, filtersKey }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(thailandPage), pageSize: String(PAGE_SIZE), sortField: thailandSortField, sortOrder: thailandSortDir });
      if (thailandSearch.trim()) {
        params.set("search", thailandSearch.trim());
        params.set("searchField", thailandSearchField);
      }
      facetQueryParams(filters).forEach((v, k) => params.set(k, v));
      return apiFetch<ThailandApiResponse>(`/api/alumni?${params}`);
    },
    enabled: mode === "thailand",
  });
  const thailandAlumni = thailandData?.data ?? [];
  const thailandTotal = thailandData?.total ?? 0;
  const thailandTotalPages = Math.max(1, Math.ceil(thailandTotal / (thailandData?.pageSize ?? PAGE_SIZE)));

  const handleThailandSort = (field: ThailandSortField) => {
    if (thailandSortField === field) {
      setThailandSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setThailandSortField(field);
      setThailandSortDir("asc");
    }
    setThailandPage(1);
  };

  const switchMode = (next: "abroad" | "thailand") => {
    if (next === mode) return;
    setMode(next);
    setThailandPage(1);
    setViewPage(1);
    setMgmtPage(1);
  };

  const qc = useQueryClient();
  const { data: abroadData, isPending: loading } = useQuery({
    queryKey: ["alumniAgency", "abroad", { search, searchField, countryFilter }],
    queryFn: () =>
      apiFetch<ApiResponse>(`/api/alumni-agency?${new URLSearchParams({ search, country: countryFilter, searchField })}`),
    enabled: mode === "abroad",
  });
  const alumni = abroadData?.data ?? [];
  const countries = abroadData?.countries ?? [];

  // View mode: flat sorted list
  const viewSortedAlumni = useMemo(() =>
    [...alumni].sort((a, b) => {
      const va = getFieldValue(a, viewSortField);
      const vb = getFieldValue(b, viewSortField);
      const cmp = va.localeCompare(vb, "th");
      return viewSortDir === "asc" ? cmp : -cmp;
    }),
    [alumni, viewSortField, viewSortDir]
  );
  const viewTotalPages = Math.max(1, Math.ceil(viewSortedAlumni.length / PAGE_SIZE));
  const pagedViewAlumni = viewSortedAlumni.slice((viewPage - 1) * PAGE_SIZE, viewPage * PAGE_SIZE);

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
  const visibleAbroad = manageMode ? pagedAlumni : pagedViewAlumni;
  const hot = useHotFields("alumni_agency", visibleAbroad.map((a) => a.id));

  const openCreate = () => {
    formReset({ studentId: "", cohort: "", prefix: "คุณ", firstName: "", lastName: "", englishName: "", workplace: "", homeAddress: "", country: "", major: "", notes: "", order: "0" });
    setEditingId(null);
    setEditReason("");
    setShowForm(true);
  };

  const openEdit = (a: AlumniAgency) => {
    formReset({ studentId: a.studentId || "", cohort: a.cohort || "", prefix: a.prefix || "", firstName: a.firstName || "", lastName: a.lastName || "", englishName: a.englishName || "", workplace: a.workplace || "", homeAddress: a.homeAddress || "", country: a.country, major: a.major || "", notes: a.notes || "", order: String(a.order) });
    setEditingId(a.id);
    setEditReason("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditReason("");
    formReset({ studentId: "", cohort: "", prefix: "คุณ", firstName: "", lastName: "", englishName: "", workplace: "", homeAddress: "", country: "", major: "", notes: "", order: "0" });
  };

  const onSave = async (data: AbroadFormValues) => {
    setErrorMsg("");
    if (editingId && !editReason) {
      setErrorMsg("กรุณาเลือกเหตุผลในการแก้ไข");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        studentId: data.studentId.trim() || null,
        cohort: data.cohort.trim() || null,
        prefix: data.prefix.trim() || null,
        firstName: data.firstName.trim() || null,
        lastName: data.lastName.trim() || null,
        englishName: data.englishName.trim() || null,
        workplace: data.workplace.trim() || null,
        homeAddress: data.homeAddress.trim() || null,
        country: data.country.trim(),
        major: data.major.trim() || null,
        notes: data.notes.trim() || null,
        order: Number(data.order) || 0,
        ...(editingId ? { reason: editReason } : {}),
      };
      if (editingId) {
        await apiFetch(`/api/alumni-agency/${editingId}`, { method: "PUT", json: payload });
      } else {
        await apiFetch(`/api/alumni-agency`, { method: "POST", json: payload });
      }
      closeForm();
      qc.invalidateQueries({ queryKey: queryKeys.alumniAgency.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/api/alumni-agency/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: queryKeys.alumniAgency.all });
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
      await apiFetch(`/api/alumni-agency/bulk-delete`, { method: "POST", json: { ids } });
      deselectAll();
      setShowBulkDeleteDialog(false);
      qc.invalidateQueries({ queryKey: queryKeys.alumniAgency.all });
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
      const res = await fetch(`${BASE_PATH}/api/alumni-agency/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("เกิดข้อผิดพลาด");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "alumni_agency_export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      deselectAll();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการส่งออกข้อมูล");
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams({ search, country: countryFilter, searchField });
    window.location.href = `${BASE_PATH}/api/alumni-agency/export?${params}`;
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
        `/api/alumni-agency/import`,
        { method: "POST", body: formData },
      );
      setImportResult(data);
      qc.invalidateQueries({ queryKey: queryKeys.alumniAgency.all });
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          ต้นสังกัดศิษย์เก่า
        </h1>
        {mode === "abroad" && (!manageMode ? (
          canWrite && (<button onClick={() => { setManageMode(true); deselectAll(); }} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            จัดการข้อมูล
          </button>)
        ) : (
          <button onClick={() => { setManageMode(false); setShowForm(false); deselectAll(); }} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50">
            กลับหน้าเดิม
          </button>
        ))}
      </div>

      {/* Thailand / Abroad mode toggle (PRD §3.9) */}
      <div className="mb-8 inline-flex rounded-lg border border-[var(--border)] bg-white p-1">
        <button
          type="button"
          onClick={() => switchMode("thailand")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "thailand"
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--foreground)] hover:bg-gray-100"
          }`}
        >
          ข้อมูลในประเทศ
        </button>
        <button
          type="button"
          onClick={() => switchMode("abroad")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "abroad"
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--foreground)] hover:bg-gray-100"
          }`}
        >
          ข้อมูลต่างประเทศ
        </button>
      </div>

      {mode === "abroad" && (<>
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
            {editingId ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"}
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
              <label className="mb-1 block text-sm font-medium text-gray-700">ค้นหาชื่อศิษย์เก่า</label>
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => { setNameSearch(e.target.value); searchAlumni(e.target.value); setFormSearchField("name"); setValue("studentId", ""); }}
                placeholder="พิมพ์ชื่อเพื่อค้นหาศิษย์เก่า..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
            <FormField label="สาขาวิชา">
              <FormInput registration={register("major")} type="text" />
            </FormField>
            <FormField label="รุ่น">
              <FormInput registration={register("cohort")} type="text" />
            </FormField>
            <FormField label="คำนำหน้า">
              <FormInput registration={register("prefix")} type="text" />
            </FormField>
            <FormField label="ชื่อ" required error={errors.firstName?.message}>
              <FormInput registration={register("firstName")} error={errors.firstName?.message} type="text" />
            </FormField>
            <FormField label="นามสกุล">
              <FormInput registration={register("lastName")} type="text" />
            </FormField>
            <FormField label="ชื่ออังกฤษ">
              <FormInput registration={register("englishName")} type="text" />
            </FormField>
            <FormField label="สถานที่ทำงาน" className="sm:col-span-2">
              <FormTextarea registration={register("workplace")} rows={3} />
            </FormField>
            <FormField label="ที่อยู่บ้าน" className="sm:col-span-2">
              <FormTextarea registration={register("homeAddress")} rows={2} />
            </FormField>
            <FormField label="ประเทศ" required error={errors.country?.message}>
              <FormInput registration={register("country")} error={errors.country?.message} type="text" list="country-list" />
              <datalist id="country-list">
                {countries.map((c) => <option key={c} value={c} />)}
              </datalist>
            </FormField>
            <FormField label="หมายเหตุ">
              <FormInput registration={register("notes")} type="text" />
            </FormField>
            <FormField label="ลำดับ">
              <FormInput registration={register("order")} type="number" />
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
                  {manageMode && (
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={pagedAlumni.length > 0 && isAllSelected(pagedAlumni.map((item) => item.id))}
                        onChange={(e) => {
                          if (e.target.checked) selectAll(pagedAlumni.map((item) => item.id));
                          else deselectAll();
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>
                  )}
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
                    <td className="px-4 py-3 text-center">{(mgmtPage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-3 text-[var(--muted)]"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="cohort" value={a.cohort || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3">{a.prefix || "-"}</td>
                    <td className="px-4 py-3"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="firstName" value={a.firstName || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="lastName" value={a.lastName || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3 text-[var(--muted)]"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="englishName" value={a.englishName || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="country" value={a.country} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3 text-[var(--muted)] max-w-xs truncate"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="workplace" value={a.workplace || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3 text-[var(--muted)] max-w-xs truncate"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="homeAddress" value={a.homeAddress || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3 text-[var(--muted)]"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="notes" value={a.notes || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(a)} className="rounded p-1.5 text-purple-600 hover:bg-purple-100" title="แก้ไข">
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
                <button onClick={() => { setMgmtPage(Math.max(1, mgmtPage - 1)); deselectAll(); }} disabled={mgmtPage === 1} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
                {getPageNumbers(mgmtPage, mgmtTotalPages).map((p, i) => (
                  p === "dots" ? <span key={`dots-${i}`} className="px-1 text-gray-400">…</span> :
                  <button key={p} onClick={() => { setMgmtPage(p); deselectAll(); }} className={`rounded-md px-3 py-1.5 text-sm ${mgmtPage === p ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"}`}>{p}</button>
                ))}
                <button onClick={() => { setMgmtPage(Math.min(mgmtTotalPages, mgmtPage + 1)); deselectAll(); }} disabled={mgmtPage === mgmtTotalPages} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* View mode: single flat table */
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--primary)] text-white">
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
                {pagedViewAlumni.map((a, idx) => (
                  <tr key={a.id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 text-center">{(viewPage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-3 text-[var(--muted)]"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="cohort" value={a.cohort || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3">{a.prefix || "-"}</td>
                    <td className="px-4 py-3">{a.firstName || "-"}</td>
                    <td className="px-4 py-3">{a.lastName || "-"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="englishName" value={a.englishName || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="country" value={a.country} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3 text-[var(--muted)]"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="workplace" value={a.workplace || "-"} hotFields={hot[a.id]} /></td>
                    <td className="px-4 py-3 text-[var(--muted)]"><OrangeCell resourceType="alumni_agency" recordId={a.id} field="homeAddress" value={a.homeAddress || "-"} hotFields={hot[a.id]} /></td>
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
          {viewTotalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
              <span className="text-sm text-gray-500">แสดง {viewSortedAlumni.length === 0 ? 0 : (viewPage - 1) * PAGE_SIZE + 1}-{Math.min(viewPage * PAGE_SIZE, viewSortedAlumni.length)} จาก {viewSortedAlumni.length} รายการ</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setViewPage(Math.max(1, viewPage - 1))} disabled={viewPage === 1} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
                {getPageNumbers(viewPage, viewTotalPages).map((p, i) => (
                  p === "dots" ? <span key={`dots-${i}`} className="px-1 text-gray-400">…</span> :
                  <button key={p} onClick={() => setViewPage(p)} className={`rounded-md px-3 py-1.5 text-sm ${viewPage === p ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"}`}>{p}</button>
                ))}
                <button onClick={() => setViewPage(Math.min(viewTotalPages, viewPage + 1))} disabled={viewPage === viewTotalPages} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
              </div>
            </div>
          )}
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
      </>)}

      {/* Thailand mode (PRD §3.9) — read-only alumni view */}
      {mode === "thailand" && (
        <>
          {/* Filters: search + workplace facet */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <select
              value={thailandSearchField}
              onChange={(e) => { setThailandSearchField(e.target.value as ThailandSearchField); setThailandSearch(""); setThailandPage(1); }}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-white focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              {THAILAND_SEARCH_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder={`ค้นหา${THAILAND_SEARCH_FIELDS.find((f) => f.value === thailandSearchField)?.label}...`}
              value={thailandSearch}
              onChange={(e) => { setThailandSearch(e.target.value); setThailandPage(1); }}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            <div className="w-full shrink-0 sm:w-64">
              <FacetFilter
                entity="alumni"
                field="currentWorkplace"
                label="สถานที่ทำงาน"
                selected={filters.currentWorkplace ?? []}
                onChange={(v) => setFilter("currentWorkplace", v)}
              />
            </div>
          </div>

          {/* Thailand table */}
          {thailandLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : thailandAlumni.length === 0 ? (
            <div className="py-12 text-center text-[var(--muted)]">ไม่พบข้อมูล</div>
          ) : (
            <div className="overflow-hidden rounded-lg bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--primary)] text-white">
                      <th className="w-12 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">ลำดับ</th>
                      {THAILAND_SORT_FIELDS.map(({ field, label }) => (
                        <th
                          key={field}
                          onClick={() => handleThailandSort(field)}
                          className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10"
                        >
                          {label}
                          <SortIcon active={thailandSortField === field} dir={thailandSortField === field ? thailandSortDir : "asc"} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {thailandAlumni.map((a, idx) => (
                      <tr key={a.id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3 text-center">{(thailandPage - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-gray-700">{a.studentId || "-"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{a.cohort || "-"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{a.major || "-"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{a.prefix || "-"}</td>
                        <td className="px-4 py-3">{a.firstName || "-"}</td>
                        <td className="px-4 py-3">{a.newLastName || a.maidenLastName || "-"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{a.englishName || "-"}</td>
                        <td className="px-4 py-3 text-[var(--muted)] max-w-xs truncate">{a.currentWorkplace || "-"}</td>
                        <td className="px-4 py-3 text-[var(--muted)] max-w-xs truncate">{a.homeAddress || "-"}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{a.remarks || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {thailandTotalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
                  <span className="text-sm text-gray-500">แสดง {thailandTotal === 0 ? 0 : (thailandPage - 1) * PAGE_SIZE + 1}-{Math.min(thailandPage * PAGE_SIZE, thailandTotal)} จาก {thailandTotal} รายการ</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setThailandPage(Math.max(1, thailandPage - 1))} disabled={thailandPage === 1} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
                    {getPageNumbers(thailandPage, thailandTotalPages).map((p, i) => (
                      p === "dots" ? <span key={`dots-${i}`} className="px-1 text-gray-400">…</span> :
                      <button key={p} onClick={() => setThailandPage(p)} className={`rounded-md px-3 py-1.5 text-sm ${thailandPage === p ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"}`}>{p}</button>
                    ))}
                    <button onClick={() => setThailandPage(Math.min(thailandTotalPages, thailandPage + 1))} disabled={thailandPage === thailandTotalPages} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

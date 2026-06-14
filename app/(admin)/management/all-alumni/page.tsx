"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCanWrite } from "@/lib/role-context";
import { useBulkSelection } from "@/lib/useBulkSelection";
import { useRouter } from "next/navigation";
import { PAGE_SIZE, PREFIX_OPTIONS, DEGREE_LEVEL_OPTIONS, BASE_PATH } from "@/lib/constants";
import { alumniEditFormSchema, type AlumniEditFormData } from "@/lib/validations";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";

type ManageSortField = "studentId" | "prefix" | "firstName" | "maidenLastName" | "newLastName" | "cohort" | "province";
type ViewSortField = "studentId" | "name" | "surname" | "degreeLevel" | "major" | "year";
type SortDir = "asc" | "desc";

const DEGREE_COLORS: Record<string, string> = {
  NURSING_ASSISTANT: "#f57f17",
  ASSOCIATE: "#00838f",
  BACHELOR: "#5b21b6",
  MASTER: "#2e7d32",
  DOCTORAL: "#c62828",
};

interface Alumni {
  id: string;
  studentId: string;
  prefix: string;
  firstName: string;
  maidenLastName: string;
  newLastName: string | null;
  cohort: string | null;
  degreeLevel: string | null;
  province: string | null;
  email: string | null;
  phone: string | null;
  currentWorkplace: string | null;
  country: string | null;
  isPotential: boolean;
  isModelRepresentative: boolean;
  photoUrl: string | null;
}

interface AlumniApiResponse {
  data: Alumni[];
  total: number;
}

// CMU Registrar API data shape (from /api/cmu-alumni proxy)
interface CmuAlumni {
  student_id: string;
  name_th: string;
  middle_name_th: string;
  surname_th: string;
  name_en: string;
  surname_en: string;
  level_id: string;
  major_name_th: string;
  major_sub_name_th: string;
  grad_year: string;
  grad_semester: string;
  std_mobile: string;
  adm_type: string;
  cohort?: string | null;
}

// Map CMU registrar level_id to Thai degree labels
const CMU_LEVEL_LABELS: Record<string, string> = {
  "0": "อนุปริญญา",
  "1": "ปริญญาตรี",
  "2": "ผู้ช่วยพยาบาล",
  "3": "ปริญญาโท",
  "5": "ปริญญาเอก",
};

/** Resolve display label for level_id, accounting for the special case where
 *  level_id=0 + major_name_th='ประกาศนียบัตรผู้ช่วยพยาบาล' → ประกาศนียบัตรบัณฑิต. */
function getLevelLabel(level_id: string, major_name_th: string): string {
  if (level_id === "0" && major_name_th === "ประกาศนียบัตรผู้ช่วยพยาบาล") {
    return "ประกาศนียบัตรบัณฑิต";
  }
  return CMU_LEVEL_LABELS[level_id] || level_id;
}

const EMPTY_EDIT_FORM: AlumniEditFormData = {
  studentId: "",
  prefix: "",
  firstName: "",
  maidenLastName: "",
  cohort: "",
  degreeLevel: "",
  newLastName: "",
  province: "",
  email: "",
  phone: "",
  currentWorkplace: "",
  country: "",
};

/** Check if an id looks like a UUID (local DB record) vs a student_id (CMU-only record). */
function isLocalRecordId(id: string): boolean {
  return id.includes("-"); // UUIDs have dashes, student IDs are numeric only
}

export default function AlumniCountPage() {
  const canWrite = useCanWrite();
  const router = useRouter();

  // State
  const [manageMode, setManageMode] = useState(false);
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [totalAlumni, setTotalAlumni] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [degreeLevelFilter, setDegreeLevelFilter] = useState("");
  const [sortField, setSortField] = useState<ManageSortField | ViewSortField>("studentId");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [tableLoading, setTableLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors: formErrors }, reset: formReset } = useForm<AlumniEditFormData>({
    resolver: zodResolver(alumniEditFormSchema) as any,
    defaultValues: EMPTY_EDIT_FORM,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
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

  // Fetch alumni table data (local DB + CMU — used in manage mode)
  const fetchAlumni = useCallback(async () => {
    setTableLoading(true);
    try {
      // Fetch CMU alumni data
      const cmuParams = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
        sortField: sortField as string,
        sortDir,
      });
      if (degreeLevelFilter) cmuParams.set("degreeLevel", degreeLevelFilter);
      const cmuRes = await fetch(`${BASE_PATH}/api/cmu-alumni?${cmuParams}`);
      let cmuData: CmuAlumni[] = [];
      let cmuTotalCount = 0;
      if (cmuRes.ok) {
        const cmuJson = await cmuRes.json();
        cmuData = cmuJson.data || [];
        cmuTotalCount = cmuJson.total || 0;
      }

      // Fetch ALL local alumni (including soft-deleted) to build overlay map
      const localRes = await fetch(`${BASE_PATH}/api/alumni?pageSize=9999&includeDeleted=true`);
      let localMap: Record<string, Alumni> = {};
      let deletedStudentIds = new Set<string>();
      if (localRes.ok) {
        const localJson: AlumniApiResponse = await localRes.json();
        for (const a of localJson.data) {
          if (a.studentId) {
            localMap[a.studentId] = a;
            // Track soft-deleted records
            if ((a as Alumni & { deletedAt?: string | null }).deletedAt) {
              deletedStudentIds.add(a.studentId);
            }
          }
        }
      }

      // Map CMU records to Alumni shape, overlaying local data where available.
      // Skip records that have been soft-deleted locally.
      const merged: Alumni[] = [];
      const localStudentIdsUsed = new Set<string>();

      for (const c of cmuData) {
        // Skip CMU records that were soft-deleted locally
        if (deletedStudentIds.has(c.student_id)) continue;

        const local = localMap[c.student_id];
        localStudentIdsUsed.add(c.student_id);

        if (local) {
          merged.push(local);
        } else {
          merged.push({
            id: c.student_id,
            studentId: c.student_id,
            prefix: "",
            firstName: c.name_th || "",
            maidenLastName: c.surname_th || "",
            newLastName: null,
            cohort: null,
            degreeLevel: null,
            province: null,
            email: null,
            phone: null,
            currentWorkplace: null,
            country: null,
            isPotential: false,
            isModelRepresentative: false,
            photoUrl: null,
          });
        }
      }

      // Append local-only records (not in CMU data) that are not soft-deleted
      for (const a of Object.values(localMap)) {
        if (!localStudentIdsUsed.has(a.studentId) && !deletedStudentIds.has(a.studentId)) {
          merged.push(a);
        }
      }

      // Adjust total: start from CMU total, subtract soft-deleted, add local-only
      const adjustedTotal = cmuTotalCount - deletedStudentIds.size +
        Object.values(localMap).filter(a => !localStudentIdsUsed.has(a.studentId) && !deletedStudentIds.has(a.studentId)).length;

      setAlumni(merged);
      setTotalAlumni(Math.max(0, adjustedTotal));
    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
    }
  }, [page, search, degreeLevelFilter, sortField, sortDir]);

  // CMU Registrar data (view mode only)
  const [cmuAlumni, setCmuAlumni] = useState<CmuAlumni[]>([]);
  const [cmuTotal, setCmuTotal] = useState(0);

  const fetchCmuAlumni = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
        sortField: sortField as string,
        sortDir,
      });
      if (degreeLevelFilter) params.set("degreeLevel", degreeLevelFilter);
      const res = await fetch(`${BASE_PATH}/api/cmu-alumni?${params}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to fetch CMU data");
      }
      const data = await res.json();

      // Fetch local alumni (including soft-deleted) for overlay and filtering
      let localMap: Record<string, Alumni & { deletedAt?: string | null }> = {};
      let deletedStudentIds = new Set<string>();
      try {
        const localRes = await fetch(`${BASE_PATH}/api/alumni?pageSize=9999&includeDeleted=true`);
        if (localRes.ok) {
          const localData = await localRes.json();
          for (const a of localData.data) {
            if (a.studentId) {
              localMap[a.studentId] = a;
              if (a.deletedAt) {
                deletedStudentIds.add(a.studentId);
              }
            }
          }
        }
      } catch {}

      // Merge: overlay local data on CMU records, skip soft-deleted
      const merged: CmuAlumni[] = [];
      for (const a of data.data as CmuAlumni[]) {
        // Skip soft-deleted records
        if (deletedStudentIds.has(a.student_id)) continue;

        const local = localMap[a.student_id];
        if (local) {
          // Local record overrides — use local firstName/lastName if available
          merged.push({
            ...a,
            name_th: local.firstName || a.name_th,
            surname_th: local.maidenLastName || a.surname_th,
            cohort: local.cohort || null,
          });
        } else {
          merged.push({
            ...a,
            cohort: null,
          });
        }
      }

      // Adjust total by subtracting soft-deleted count
      const adjustedTotal = data.total - deletedStudentIds.size;
      setCmuAlumni(merged);
      setCmuTotal(Math.max(0, adjustedTotal));
    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
    }
  }, [page, search, degreeLevelFilter, sortField, sortDir]);

  useEffect(() => {
    if (manageMode) {
      fetchAlumni();
    } else {
      fetchCmuAlumni();
    }
  }, [manageMode, fetchAlumni, fetchCmuAlumni]);

  const activeTotal = manageMode ? totalAlumni : cmuTotal;
  const totalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE));

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

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleFilter = (value: string) => {
    setDegreeLevelFilter(value);
    setPage(1);
  };

  const handleSort = (field: ManageSortField | ViewSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: ManageSortField | ViewSortField }) => (
    <span className="ml-1 inline-block">{sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▽"}</span>
  );

  const openEdit = (a: Alumni) => {
    formReset({
      studentId: a.studentId,
      prefix: a.prefix,
      firstName: a.firstName,
      maidenLastName: a.maidenLastName,
      cohort: a.cohort || "",
      degreeLevel: a.degreeLevel || "",
      newLastName: a.newLastName || "",
      province: a.province || "",
      email: a.email || "",
      phone: a.phone || "",
      currentWorkplace: a.currentWorkplace || "",
      country: a.country || "",
    });
    setEditingId(a.id);
  };

  const closeForm = () => {
    setEditingId(null);
    formReset(EMPTY_EDIT_FORM);
  };

  const handleSave = async (data: AlumniEditFormData) => {
    setSaving(true);
    setErrorMsg("");
    try {
      const payload = {
        studentId: data.studentId.trim(),
        prefix: data.prefix,
        firstName: data.firstName.trim(),
        maidenLastName: data.maidenLastName.trim(),
        cohort: data.cohort.trim() || null,
        degreeLevel: data.degreeLevel || null,
        newLastName: data.newLastName.trim() || null,
        province: data.province.trim() || null,
        email: data.email.trim() || null,
        phone: data.phone.trim() || null,
        currentWorkplace: data.currentWorkplace.trim() || null,
        country: data.country.trim() || null,
      };

      // CMU-only record (not yet in local DB) → POST to create
      // Local record (already in DB) → PUT to update
      const isLocal = editingId && isLocalRecordId(editingId);
      const res = await fetch(
        `${BASE_PATH}/api/alumni${isLocal ? `/${editingId}` : ""}`,
        {
          method: isLocal ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.error || "เกิดข้อผิดพลาด");
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
      if (isLocalRecordId(deleteId)) {
        // Local record → soft delete via DELETE endpoint
        const res = await fetch(`${BASE_PATH}/api/alumni/${deleteId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
      } else {
        // CMU-only record → create a soft-deleted local record to hide it
        const alumniRecord = alumni.find((a) => a.id === deleteId);
        if (alumniRecord) {
          await fetch(`${BASE_PATH}/api/alumni`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: alumniRecord.studentId,
              prefix: alumniRecord.prefix || "นางสาว",
              firstName: alumniRecord.firstName,
              maidenLastName: alumniRecord.maidenLastName,
              cohort: alumniRecord.cohort || null,
              degreeLevel: alumniRecord.degreeLevel || null,
              softDelete: true,
            }),
          });
        }
      }
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
      // Separate local records (UUID) from CMU-only records (student_id)
      const localIds = ids.filter((id) => isLocalRecordId(id));
      const cmuIds = ids.filter((id) => !isLocalRecordId(id));

      // Soft delete local records via bulk-delete endpoint
      if (localIds.length > 0) {
        const res = await fetch(`${BASE_PATH}/api/alumni/bulk-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: localIds }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "เกิดข้อผิดพลาด");
        }
      }

      // For CMU-only records, create soft-deleted local records to hide them
      for (const cmuId of cmuIds) {
        const record = alumni.find((a) => a.id === cmuId);
        if (record) {
          await fetch(`${BASE_PATH}/api/alumni`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: record.studentId,
              prefix: record.prefix || "นางสาว",
              firstName: record.firstName,
              maidenLastName: record.maidenLastName,
              cohort: record.cohort || null,
              degreeLevel: record.degreeLevel || null,
              softDelete: true,
            }),
          });
        }
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
      const res = await fetch(`${BASE_PATH}/api/alumni/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("เกิดข้อผิดพลาด");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "alumni_export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      deselectAll();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการส่งออกข้อมูล");
    }
  };

  const enterManageMode = () => {
    setManageMode(true);
    setPage(1);
    setSearch("");
    setDegreeLevelFilter("");
    setSortField("studentId");
    setSortDir("asc");
    setEditingId(null);
    deselectAll();
  };

  const exitManageMode = () => {
    setManageMode(false);
    setEditingId(null);
    setErrorMsg("");
    deselectAll();
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (degreeLevelFilter) params.set("degreeLevel", degreeLevelFilter);
    window.location.href = `${BASE_PATH}/api/alumni/export?${params}`;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE_PATH}/api/alumni/import`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      setImportResult(data);
      fetchAlumni();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้า"
      );
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
          จำนวนนักศึกษาเก่าตามระดับการศึกษา
        </h1>
        {!manageMode ? (
          canWrite && (
          <button
            onClick={enterManageMode}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            จัดการข้อมูล
          </button>
          )
        ) : (
          <button
            onClick={exitManageMode}
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
            <span>
              นำเข้าสำเร็จ {importResult.imported} รายการ
              {importResult.skipped > 0 &&
                ` (ข้าม ${importResult.skipped} รายการ)`}
            </span>
            <button
              onClick={() => setImportResult(null)}
              className="ml-4 font-bold text-green-500 hover:text-green-700"
            >
              &times;
            </button>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-2 border-t border-green-200 pt-2">
              <p className="font-medium">
                ข้อผิดพลาด ({importResult.errors.length} รายการ):
              </p>
              <ul className="mt-1 list-disc pl-4 text-xs">
                {importResult.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>
                    แถวที่ {err.row}: {err.message}
                  </li>
                ))}
                {importResult.errors.length > 10 && (
                  <li>...และอีก {importResult.errors.length - 10} รายการ</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {manageMode ? (
        <>
          {/* Edit form */}
          {editingId && (
            <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">
                แก้ไขข้อมูล
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="รหัสนักศึกษา" required error={formErrors.studentId?.message}>
                  <FormInput registration={register("studentId")} error={formErrors.studentId?.message} type="text" />
                </FormField>
                <FormField label="คำนำหน้า" required error={formErrors.prefix?.message}>
                  <FormSelect registration={register("prefix")} error={formErrors.prefix?.message}>
                    <option value="">-- เลือกคำนำหน้า --</option>
                    {PREFIX_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField label="ชื่อ" required error={formErrors.firstName?.message}>
                  <FormInput registration={register("firstName")} error={formErrors.firstName?.message} type="text" />
                </FormField>
                <FormField label="นามสกุลเดิม" required error={formErrors.maidenLastName?.message}>
                  <FormInput registration={register("maidenLastName")} error={formErrors.maidenLastName?.message} type="text" />
                </FormField>
                <FormField label="นามสกุลใหม่">
                  <FormInput registration={register("newLastName")} type="text" />
                </FormField>
                <FormField label="รุ่น/สาขา">
                  <FormInput registration={register("cohort")} type="text" />
                </FormField>
                <FormField label="ระดับการศึกษา">
                  <FormSelect registration={register("degreeLevel")}>
                    <option value="">-- เลือกระดับการศึกษา --</option>
                    {DEGREE_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField label="จังหวัด">
                  <FormInput registration={register("province")} type="text" />
                </FormField>
                <FormField label="อีเมล">
                  <FormInput registration={register("email")} type="email" />
                </FormField>
                <FormField label="เบอร์โทร">
                  <FormInput registration={register("phone")} type="text" />
                </FormField>
                <FormField label="สถานที่ทำงาน">
                  <FormInput registration={register("currentWorkplace")} type="text" />
                </FormField>
                <FormField label="ประเทศ">
                  <FormInput registration={register("country")} type="text" />
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
                  onClick={handleSubmit(handleSave)}
                  disabled={saving}
                  className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!editingId && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => router.push("/new-alumni")}
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
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors"
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
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                ส่งออก Excel
              </button>
              <input
                type="file"
                accept=".xlsx,.xls"
                ref={importFileRef}
                onChange={handleImport}
                className="hidden"
              />
              <button
                onClick={() => importFileRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-green-600 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-600 hover:text-white transition-colors disabled:opacity-50"
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
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m16.5-12L12 7.5m0 0L7.5 4.5M12 7.5V21"
                  />
                </svg>
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
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="ค้นหาชื่อ, นามสกุล, รหัสนักศึกษา..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            <select
              value={degreeLevelFilter}
              onChange={(e) => handleFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="">ทุกระดับการศึกษา</option>
              {DEGREE_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Alumni table */}
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-white text-left"
                    style={{ backgroundColor: "#5b21b6" }}
                  >
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={alumni.length > 0 && isAllSelected(alumni.map((a) => a.id))}
                        onChange={(e) => {
                          if (e.target.checked) selectAll(alumni.map((a) => a.id));
                          else deselectAll();
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>
                    <th className="w-16 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      ลำดับ
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("studentId")}>
                      รหัสนักศึกษา <SortIcon field="studentId" />
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("cohort")}>
                      รุ่น <SortIcon field="cohort" />
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("prefix")}>
                      คำนำหน้า <SortIcon field="prefix" />
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("firstName")}>
                      ชื่อ <SortIcon field="firstName" />
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("maidenLastName")}>
                      นามสกุลเดิม <SortIcon field="maidenLastName" />
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("newLastName")}>
                      นามสกุลใหม่ <SortIcon field="newLastName" />
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("province")}>
                      จังหวัด <SortIcon field="province" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <div className="flex justify-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                        </div>
                      </td>
                    </tr>
                  ) : alumni.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center text-[var(--muted)]"
                      >
                        ไม่พบข้อมูล
                      </td>
                    </tr>
                  ) : (
                    alumni.map((a, idx) => (
                      <tr
                        key={a.id}
                        className="border-b border-[var(--border)] transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected(a.id)}
                            onChange={() => toggleSelect(a.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3">{a.studentId}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {a.cohort || "-"}
                        </td>
                        <td className="px-4 py-3">{a.prefix}</td>
                        <td className="px-4 py-3">{a.firstName}</td>
                        <td className="px-4 py-3">{a.maidenLastName}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {a.newLastName || "-"}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {a.province || "-"}
                        </td>
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
                <span className="text-sm text-gray-500">แสดง {activeTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, activeTotal)} จาก {activeTotal} รายการ</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setPage(Math.max(1, page - 1)); deselectAll(); }}
                    disabled={page === 1}
                    className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
                  >
                    ก่อนหน้า
                  </button>
                  {paginationNumbers.map((p, i) =>
                    p === "..." ? (
                      <span key={`dot-${i}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => { setPage(p); deselectAll(); }}
                        className={`rounded-md px-3 py-1.5 text-sm ${
                          page === p
                            ? "bg-[var(--primary)] text-white"
                            : "border border-[var(--border)] bg-white hover:bg-gray-100"
                        }`}
                      >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
                >
                  ถัดไป
                </button>
              </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* View mode: read-only alumni table */
        <>
          {/* Search */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="ค้นหาชื่อ, นามสกุล, รหัสนักศึกษา..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            <select
              value={degreeLevelFilter}
              onChange={(e) => handleFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="">ทุกระดับการศึกษา</option>
              {DEGREE_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Alumni table (read-only, CMU Registrar data) */}
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-white text-left"
                    style={{ backgroundColor: "#5b21b6" }}
                  >
                    <th className="w-16 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      ลำดับ
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("studentId")}>
                      รหัสนักศึกษา <SortIcon field="studentId" />
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      รุ่น
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("name")}>
                      ชื่อ <SortIcon field="name" />
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("surname")}>
                      นามสกุล <SortIcon field="surname" />
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("degreeLevel")}>
                      ระดับการศึกษา <SortIcon field="degreeLevel" />
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("major")}>
                      สาขาวิชา <SortIcon field="major" />
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("year")}>
                      ปีที่สำเร็จการศึกษา <SortIcon field="year" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="flex justify-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                        </div>
                      </td>
                    </tr>
                  ) : cmuAlumni.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-[var(--muted)]"
                      >
                        ไม่พบข้อมูล
                      </td>
                    </tr>
                  ) : (
                    cmuAlumni.map((a, idx) => {
                      const levelLabel = getLevelLabel(a.level_id, a.major_name_th);
                      return (
                        <tr
                          key={a.student_id}
                          className="border-b border-[var(--border)] transition-colors hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 text-center">
                            {(page - 1) * PAGE_SIZE + idx + 1}
                          </td>
                          <td className="px-4 py-3">{a.student_id}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {a.cohort || "-"}
                          </td>
                          <td className="px-4 py-3">{a.name_th || "-"}</td>
                          <td className="px-4 py-3">{a.surname_th || "-"}</td>
                          <td className="px-4 py-3">
                            <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#5b21b615", color: "#5b21b6" }}>
                              {levelLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {a.major_name_th || "-"}
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {a.grad_year || "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
                <span className="text-sm text-gray-500">แสดง {activeTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, activeTotal)} จาก {activeTotal} รายการ</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
                  >
                    ก่อนหน้า
                  </button>
                  {paginationNumbers.map((p, i) =>
                    p === "..." ? (
                      <span key={`dot-${i}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`rounded-md px-3 py-1.5 text-sm ${
                          page === p
                            ? "bg-[var(--primary)] text-white"
                            : "border border-[var(--border)] bg-white hover:bg-gray-100"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              ยืนยันการลบข้อมูล
            </h3>
            <p className="mb-6 text-sm text-gray-600">
              คุณต้องการลบข้อมูลนี้หรือไม่?
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

      {showBulkDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการลบข้อมูล</h3>
            <p className="mb-6 text-sm text-gray-600">
              คุณต้องการลบข้อมูล <span className="font-bold text-red-600">{selectedCount}</span> รายการหรือไม่?
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

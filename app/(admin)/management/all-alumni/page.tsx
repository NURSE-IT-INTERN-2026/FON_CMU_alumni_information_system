"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useBulkSelection } from "@/lib/useBulkSelection";
import { useRouter } from "next/navigation";
import { PAGE_SIZE, PREFIX_OPTIONS, DEGREE_LEVEL_OPTIONS, BASE_PATH } from "@/lib/constants";
import OrangeCell from "@/components/OrangeCell";
import { useHotFields } from "@/lib/use-hot-fields";
import { alumniEditFormSchema, type AlumniEditFormData } from "@/lib/validations";
import { facetQueryParams } from "@/lib/filter-facets";
import { sortAlumni } from "@/lib/alumni-sort";
import { normalizeCmuBirthday, formatBirthDateThai, bachelorCohortFromGradYear, cmuLevelToDegree } from "@/lib/alumni-verify";
import { parsePhones, joinPhones } from "@/lib/parse-phone";
import FacetFilter from "@/components/ui/facet-filter";
import SearchInput from "@/components/ui/search-input";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";

/** Thai display labels for degree-level enum values. */
const DEGREE_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  DEGREE_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
);

type ManageSortField = "studentId" | "prefix" | "firstName" | "lastName" | "cohort" | "degreeLevel" | "major" | "graduationYear" | "birthDate" | "remarks";
type ViewSortField = "studentId" | "name" | "surname" | "degreeLevel" | "major" | "year" | "cohort" | "birthDate";
type SortDir = "asc" | "desc";

interface Alumni {
  id: string;
  studentId: string;
  prefix: string;
  firstName: string;
  lastName: string;
  cohort: string | null;
  degreeLevel: string | null;
  major: string | null;
  graduationYear: number | null;
  birthDate: string | null;
  remarks: string | null;
  email: string | null;
  contactEmail: string | null;
  phones: string[];
  homeAddress: string | null;
  isPotential: boolean;
  isModelRepresentative: boolean;
  photoUrl: string | null;
  // Education studentIds (all of this alumni's degrees) — used to bridge the
  // alumni to its CMU person on ANY degree, not just the primary snapshot.
  educations?: { studentId: string }[];
}

interface AlumniApiResponse {
  data: Alumni[];
  total: number;
}

// CMU Registrar API data shape (from /api/cmu-alumni proxy)
interface CmuAlumni {
  student_id: string;
  // ALL student_ids for this CMU person (one per degree), attached by
  // dedupeCmuGraduatesByPerson. Used to bridge a local alumni to this person on
  // any of its degrees so multi-degree alumni collapse to one row.
  student_ids?: string[];
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
  // Local overlay: คำนำหน้า (prefix) from the local Alumni record — CMU has none.
  prefix?: string | null;
  // Local overlay: the bridged local alumni's UUID, so clicking an overlaid CMU
  // row navigates to the real alumni profile even when the row's student_id (the
  // CMU person's kept/highest degree id) isn't the alumni's primary studentId.
  localId?: string | null;
  // Local overlay: pre-resolved Thai degree label for local-ONLY rows (alumni
  // with no CMU record); local-only rows can't round-trip their degree level
  // through CMU's level_id losslessly, so they carry the label directly.
  degreeLabel?: string | null;
  // CMU Registrar birthday, raw "MM-DD-YYYY" (passed through by /api/cmu-alumni).
  birthday?: string | null;
  // Normalized "YYYY-MM-DD" for display + chronological sort.
  birthDate?: string | null;
}

/** Build a studentId → Alumni map covering EVERY education studentId of each
 *  local alumni (plus its primary snapshot), so a CMU record can be bridged to a
 *  local alumni on any of the alumni's degrees — collapsing multi-degree alumni
 *  to one row (matching the dashboard's person grouping). */
function buildEduSidToLocalMap(local: Alumni[]): Map<string, Alumni> {
  const m = new Map<string, Alumni>();
  for (const a of local) {
    const sids = new Set<string>();
    if (a.studentId) sids.add(a.studentId.trim());
    for (const e of a.educations ?? []) if (e.studentId) sids.add(e.studentId.trim());
    for (const s of sids) if (s) m.set(s, a);
  }
  return m;
}

/** Find the local alumni bridged to a CMU record — the alumni whose ANY
 *  education studentId appears in the CMU person's student_ids. Returns the
 *  alumni (to overlay + mark used) or undefined (CMU-only row). */
function findLocalByCmuRecord(c: CmuAlumni, eduSidToLocal: Map<string, Alumni>): Alumni | undefined {
  const sids = c.student_ids?.length ? c.student_ids : c.student_id ? [c.student_id] : [];
  for (const s of sids) {
    const a = eduSidToLocal.get(String(s).trim());
    if (a) return a;
  }
  return undefined;
}

/** Set of every student_id across the given CMU records (every person's whole
 *  degree set), trimmed. A local alumni is "represented by a CMU row" (so it is
 *  NOT shown as a local-only row) when ANY of its education studentIds is in
 *  this set — matching the dashboard's person grouping, including the case of
 *  two local rows for the same CMU person (both suppressed, one CMU row). */
function buildCmuSidSet(cmu: CmuAlumni[]): Set<string> {
  const set = new Set<string>();
  for (const c of cmu) {
    const sids = c.student_ids?.length ? c.student_ids : c.student_id ? [c.student_id] : [];
    for (const sid of sids) {
      const t = String(sid).trim();
      if (t) set.add(t);
    }
  }
  return set;
}

/** Ids of local alumni that have ANY education studentId in the CMU sid set —
 *  i.e. represented by a CMU row, so excluded from the local-only pass. */
function buildUsedAlumniIds(local: Alumni[], cmuSidSet: Set<string>, deletedStudentIds: Set<string>): Set<string> {
  const used = new Set<string>();
  for (const a of local) {
    if (deletedStudentIds.has(a.studentId)) continue;
    const sids = [a.studentId.trim(), ...(a.educations ?? []).map((e) => e.studentId.trim())];
    if (sids.some((s) => s && cmuSidSet.has(s))) used.add(a.id);
  }
  return used;
}


const EMPTY_EDIT_FORM: AlumniEditFormData = {
  studentId: "",
  prefix: "",
  firstName: "",
  lastName: "",
  cohort: "",
  degreeLevel: "",
  email: "",
  contactEmail: "",
  phones: "",
  homeAddress: "",
};

/** Check if an id looks like a UUID (local DB record) vs a student_id (CMU-only record). */
function isLocalRecordId(id: string): boolean {
  return id.includes("-"); // UUIDs have dashes, student IDs are numeric only
}

export default function AlumniCountPage() {
  const router = useRouter();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // dedupeView=true (default): collapse each person's degrees to their highest →
  // the table matches the dashboard person-count. dedupeView=false ("show all
  // degrees"): list every degree record (a multi-degree person shows one row per
  // degree). The dashboard count is unaffected — it uses a separate path.
  const [dedupeView, setDedupeView] = useState(true);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const filtersKey = facetQueryParams(filters).toString();
  const [sortField, setSortField] = useState<ManageSortField | ViewSortField>("studentId");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const qc = useQueryClient();
  // Manage mode: merge CMU Registrar + local DB (with soft-delete overlay).
  // The merge logic now lives in the queryFn and returns { merged, total }.
  // NOTE: the query is keyed WITHOUT `page` — we fetch the full merged set once
  // (per search/filter/sort) and paginate it on the client by slicing
  // `allMerged`. This is required because the merged CMU+local result can only
  // be sorted/paginated correctly once the full set is assembled.
  const manageQuery = useQuery({
    queryKey: ["alumni", "manage", { search, filtersKey, sortField, sortDir, dedupeView }],
    queryFn: async () => {
      // Fetch the FULL CMU list (not a single page) so the client can merge,
      // sort, and paginate the complete set. `/api/cmu-alumni` reads the local
      // `cmu_graduates` table (refreshed from /management/cmu-sync), so this is
      // one request per search/filter/sort.
      const cmuParams = new URLSearchParams({
        page: "1", pageSize: "50000", search,
        sortField: sortField as string, sortDir,
        dedupe: dedupeView ? "true" : "false",
      });
      facetQueryParams(filters).forEach((v, k) => cmuParams.set(k, v));
      let cmuData: CmuAlumni[] = [];
      try {
        const cmuJson = await apiFetch<{ data: CmuAlumni[]; total: number }>(`/api/cmu-alumni?${cmuParams}`);
        cmuData = cmuJson.data || [];
      } catch {}

      const localParams = new URLSearchParams({ pageSize: "50000", includeDeleted: "true" });
      facetQueryParams(filters).forEach((v, k) => localParams.set(k, v));
      const localMap: Record<string, Alumni> = {};
      const deletedStudentIds = new Set<string>();
      try {
        const localJson = await apiFetch<AlumniApiResponse>(`/api/alumni?${localParams}`);
        for (const a of localJson.data) {
          if (a.studentId) {
            localMap[a.studentId] = a;
            if ((a as Alumni & { deletedAt?: string | null }).deletedAt) deletedStudentIds.add(a.studentId);
          }
        }
      } catch {}

      const merged: Alumni[] = [];
      const eduSidToLocal = buildEduSidToLocalMap(Object.values(localMap));
      // An alumni is represented by a CMU row (excluded from local-only) when ANY
      // of its education studentIds is in CMU — collapsing multi-degree alumni
      // AND duplicate local rows for the same CMU person to one row, like the
      // dashboard. The overlay below picks which alumni's data a CMU row shows.
      const usedAlumni = buildUsedAlumniIds(Object.values(localMap), buildCmuSidSet(cmuData), deletedStudentIds);
      for (const c of cmuData) {
        if (deletedStudentIds.has(c.student_id)) continue;
        // Bridge on ANY of the CMU person's student_ids so a multi-degree alumni
        // (whose education matches a non-kept CMU degree) still overlays its CMU
        // row instead of rendering a duplicate local-only row.
        const local = findLocalByCmuRecord(c, eduSidToLocal);
        // CMU returns no cohort. For Bachelor graduates (level_id "1") derive
        // "DN{YY}" from grad_year (YY = last two digits of grad_year - 3), used
        // as a fallback so the column isn't blank. Mirrors the view-mode merge —
        // uses the CMU record's level/year so a person shows the same cohort in
        // both tables.
        const derivedCohort =
          c.level_id === "1" && c.grad_year ? bachelorCohortFromGradYear(c.grad_year) : null;
        if (!dedupeView) {
          // "Show all degrees": list every CMU degree record. Degree fields come
          // from THIS record (a multi-degree person appears once per degree);
          // local identity/contact is overlaid where the alumni exists, and the
          // row id stays the local UUID so edit/delete/navigation treat it as the
          // real alumni. The row key is made unique with the degree studentId so
          // a person's degree rows don't collide.
          const cmuDegreeLevel = cmuLevelToDegree(c.level_id, c.major_name_th);
          if (local) {
            merged.push({
              ...local,
              studentId: c.student_id,
              degreeLevel: cmuDegreeLevel,
              major: c.major_name_th || local.major,
              graduationYear: c.grad_year ? Number(c.grad_year) : local.graduationYear,
              cohort: local.cohort || derivedCohort,
              birthDate: normalizeCmuBirthday(c.birthday) ?? local.birthDate,
            });
          } else {
            merged.push({
              id: c.student_id, studentId: c.student_id, prefix: "", firstName: c.name_th || "",
              lastName: c.surname_th || "", cohort: derivedCohort,
              degreeLevel: cmuDegreeLevel, major: c.major_name_th || null,
              graduationYear: c.grad_year ? Number(c.grad_year) : null, birthDate: normalizeCmuBirthday(c.birthday), remarks: null,
              email: null, contactEmail: null, phones: [], homeAddress: null,
              isPotential: false, isModelRepresentative: false, photoUrl: null,
            });
          }
        } else if (local) {
          merged.push({ ...local, cohort: local.cohort || derivedCohort, birthDate: normalizeCmuBirthday(c.birthday) ?? local.birthDate });
        } else {
          merged.push({
            id: c.student_id, studentId: c.student_id, prefix: "", firstName: c.name_th || "",
            lastName: c.surname_th || "", cohort: derivedCohort,
            degreeLevel: null, major: c.major_name_th || null,
            graduationYear: c.grad_year ? Number(c.grad_year) : null, birthDate: normalizeCmuBirthday(c.birthday), remarks: null,
            email: null, contactEmail: null, phones: [], homeAddress: null,
            isPotential: false, isModelRepresentative: false, photoUrl: null,
          });
        }
      }
      for (const a of Object.values(localMap)) {
        if (usedAlumni.has(a.id) || deletedStudentIds.has(a.studentId)) continue;
        // No CMU record for this alumni — derive from the local snapshot instead.
        const derivedLocal =
          a.degreeLevel === "BACHELOR" && a.graduationYear ? bachelorCohortFromGradYear(a.graduationYear) : null;
        merged.push({ ...a, cohort: a.cohort || derivedLocal });
      }
      // Sort the full merged CMU+local result client-side so local-only fields
      // (birthDate, prefix, …) reorder correctly; the CMU proxy can't sort them.
      // We hold the complete set, so the total is simply its length.
      return { merged: sortAlumni(merged, sortField, sortDir), total: merged.length };
    },
  });
  // Manage mode paginates the full merged set on the client. `allMerged` holds
  // every row (for cross-page delete/bulk-delete lookups); `alumni` is the
  // current page's slice that the table renders. Since the query is keyed
  // without `page`, navigating pages is instant (no refetch).
  const allMerged = manageQuery.data?.merged ?? [];
  const alumni = allMerged.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalAlumni = manageQuery.data?.total ?? 0;
  const [editingId, setEditingId] = useState<string | null>(null);
  const hot = useHotFields("alumni", alumni.map((a) => a.id));
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setError: setFormError, formState: { errors: formErrors }, reset: formReset } = useForm<AlumniEditFormData>({
    resolver: zodResolver(alumniEditFormSchema) as unknown as Resolver<AlumniEditFormData>,
    defaultValues: EMPTY_EDIT_FORM,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  // Editing a CMU-only record (no local row yet) creates a local OVERRIDE
  // keyed by the CMU student_id. CMU is read-only, so the studentId (the key
  // that links the override to its CMU record) is locked — only already-local
  // records (PUT path) may change it. See handleSave / PUT /api/alumni/[id].
  const editingCmuOnly = !!editingId && !isLocalRecordId(editingId);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const {
    selectedCount,
    toggleSelect,
    selectAll,
    deselectAll,
    isSelected,
    isAllSelected,
    getSelectedArray,
  } = useBulkSelection();
  const [selectMode, setSelectMode] = useState(false);
  const enterSelect = () => setSelectMode(true);
  const exitSelect = () => { setSelectMode(false); deselectAll(); };
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // CMU Registrar data (view mode only) — merge CMU + local overlay.
  const tableLoading = manageQuery.isPending;

  const activeTotal = totalAlumni;
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

  // Clamp `page` back into range when the result set shrinks (e.g. after a
  // search/filter). Done during render (not in an effect) — React discards
  // this render and re-renders immediately with the clamped page, avoiding a
  // cascading setState-in-effect. Guard on `!tableLoading` because while a
  // page query is pending, `totalPages` is transiently 1 (no data yet) and
  // clamping would snap the user back to page 1 on the first visit to a new page.
  if (!tableLoading && page > totalPages) {
    setPage(totalPages);
  }

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const setFilter = (field: string, vals: string[]) => {
    setFilters((prev) => ({ ...prev, [field]: vals }));
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

  // Render function (not a component) so React doesn't recreate a component
  // identity on every render (react-hooks/static-components).
  const renderSortIcon = (field: ManageSortField | ViewSortField) => (
    <span className="ml-1 inline-block">{sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▽"}</span>
  );

  const openEdit = (a: Alumni) => {
    formReset({
      studentId: a.studentId,
      prefix: a.prefix,
      firstName: a.firstName,
      lastName: a.lastName,
      cohort: a.cohort || "",
      degreeLevel: a.degreeLevel || "",
      email: a.email || "",
      contactEmail: a.contactEmail || "",
      phones: joinPhones(a.phones),
      homeAddress: a.homeAddress || "",
    });
    setEditingId(a.id);
  };

  const closeForm = () => {
    setEditingId(null);
    formReset(EMPTY_EDIT_FORM);
  };

  const handleSave = async (data: AlumniEditFormData) => {
    setErrorMsg("");
    const isLocal = !!editingId && isLocalRecordId(editingId);
    // studentId is the key (FK for all related tables), so it must be unique
    // across the merged view. Check the full loaded set (local + CMU) up front
    // for immediate feedback; the PUT route re-checks the local DB (409) as the
    // authoritative backstop.
    const newStudentId = data.studentId.trim();
    const conflict = allMerged.some(
      (a) => a.id !== editingId && a.studentId === newStudentId,
    );
    if (conflict) {
      setFormError("studentId", {
        type: "manual",
        message: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        studentId: data.studentId.trim(),
        prefix: data.prefix,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        cohort: data.cohort.trim() || null,
        degreeLevel: data.degreeLevel || null,
        email: data.email.trim() || null,
        contactEmail: data.contactEmail.trim() || null,
        phones: parsePhones(data.phones),
        homeAddress: data.homeAddress.trim() || null,
      };

      // CMU-only record (not yet in local DB) → POST to create
      // Local record (already in DB) → PUT to update
      await apiFetch(`/api/alumni${isLocal ? `/${editingId}` : ""}`, {
        method: isLocal ? "PUT" : "POST",
        json: payload,
      });
      closeForm();
      qc.invalidateQueries({ queryKey: queryKeys.alumni.all });
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
        await apiFetch(`/api/alumni/${deleteId}`, { method: "DELETE" });
      } else {
        // CMU-only record → create a soft-deleted local record to hide it.
        // Look up in `allMerged` (full set), not the page slice, in case the
        // row was selected on a different page before the dialog opened.
        const alumniRecord = allMerged.find((a) => a.id === deleteId);
        if (alumniRecord) {
          await apiFetch(`/api/alumni`, {
            method: "POST",
            json: {
              studentId: alumniRecord.studentId,
              prefix: alumniRecord.prefix || "นางสาว",
              firstName: alumniRecord.firstName,
              lastName: alumniRecord.lastName,
              cohort: alumniRecord.cohort || null,
              degreeLevel: alumniRecord.degreeLevel || null,
              softDelete: true,
            },
          });
        }
      }
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: queryKeys.alumni.all });
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
        await apiFetch(`/api/alumni/bulk-delete`, { method: "POST", json: { ids: localIds } });
      }

      // For CMU-only records, create soft-deleted local records to hide them.
      // Look up in `allMerged` (full set) so CMU-only rows selected on other
      // pages resolve correctly.
      for (const cmuId of cmuIds) {
        const record = allMerged.find((a) => a.id === cmuId);
        if (record) {
          await apiFetch(`/api/alumni`, {
            method: "POST",
            json: {
              studentId: record.studentId,
              prefix: record.prefix || "นางสาว",
              firstName: record.firstName,
              lastName: record.lastName,
              cohort: record.cohort || null,
              degreeLevel: record.degreeLevel || null,
              softDelete: true,
            },
          });
        }
      }

      deselectAll();
      setShowBulkDeleteDialog(false);
      qc.invalidateQueries({ queryKey: queryKeys.alumni.all });
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

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    facetQueryParams(filters).forEach((v, k) => params.set(k, v));
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
      const data = await apiFetch<{ imported: number; skipped: number; errors: { row: number; message: string }[] }>(
        `/api/alumni/import`,
        { method: "POST", body: formData },
      );
      setImportResult(data);
      qc.invalidateQueries({ queryKey: queryKeys.alumni.all });
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
        {selectMode ? (
          <div className="flex items-center gap-2">
            <button onClick={() => (isAllSelected(alumni.map((a) => a.id)) ? deselectAll() : selectAll(alumni.map((a) => a.id)))} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50">
              เลือกทั้งหมดในหน้านี้
            </button>
            <button onClick={exitSelect} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
              เสร็จสิ้น
            </button>
          </div>
        ) : (
          <button onClick={enterSelect} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            เลือก
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

          {/* Edit form */}
          {editingId && (
            <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">
                แก้ไขข้อมูล
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="รหัสนักศึกษา" required error={formErrors.studentId?.message}>
                  <FormInput
                    registration={register("studentId")}
                    error={formErrors.studentId?.message}
                    type="text"
                    readOnly={editingCmuOnly}
                    className={editingCmuOnly ? "cursor-not-allowed bg-gray-100 text-gray-500" : ""}
                    title={editingCmuOnly ? "รหัสนักศึกษาจากระบบทะเบียน ใช้เป็นคีย์เชื่อมข้อมูล จึงแก้ไขไม่ได้" : undefined}
                  />
                  {editingCmuOnly && (
                    <p className="mt-1 text-xs text-gray-400">
                      รหัสนักศึกษาจากระบบทะเบียน — แก้ไขไม่ได้ (บันทึกเป็นข้อมูลทับระเบียน)
                    </p>
                  )}
                </FormField>
                <FormField label="คำนำหน้า" error={formErrors.prefix?.message}>
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
                <FormField label="นามสกุล" required error={formErrors.lastName?.message}>
                  <FormInput registration={register("lastName")} error={formErrors.lastName?.message} type="text" />
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
                <FormField label="อีเมล (เข้าสู่ระบบ)">
                  <FormInput registration={register("email")} type="email" />
                </FormField>
                <FormField label="อีเมลติดต่อ">
                  <FormInput registration={register("contactEmail")} type="email" />
                </FormField>
                <FormField label="เบอร์โทร (คั่นหลายเบอร์ด้วยจุลภาค)">
                  <FormInput registration={register("phones")} type="text" />
                </FormField>
                <FormField label="ที่อยู่ปัจจุบัน">
                  <FormInput registration={register("homeAddress")} type="text" />
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
                onClick={() => router.push("/management/new-alumni")}
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

          {/* Search + view options */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={search}
              onSearch={handleSearch}
              placeholder="ค้นหาชื่อ, นามสกุล, รหัสนักศึกษา..."
              formClassName="sm:flex-1"
            />
            <label
              className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-gray-700"
              title="เมื่อเลือก จะแสดงทุกรายวุฒิของผู้ที่มีหลายรายวุฒิเป็นคนละแถว (ไม่รวมรายวุฒิซ้ำเป็นคนเดียว)"
            >
              <input
                type="checkbox"
                checked={!dedupeView}
                onChange={(e) => { setDedupeView(!e.target.checked); setPage(1); }}
                className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              แยกรายการตามรายวุฒิ
            </label>
          </div>

          {/* Facet filters */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FacetFilter entity="alumni" field="degreeLevel" label="ระดับการศึกษา" valueLabels={DEGREE_LEVEL_LABELS} selected={filters.degreeLevel ?? []} onChange={(v) => setFilter("degreeLevel", v)} queryParams={{ dedupe: dedupeView ? "true" : "false" }} />
            <FacetFilter entity="alumni" field="major" label="สาขาวิชา" selected={filters.major ?? []} onChange={(v) => setFilter("major", v)} queryParams={{ dedupe: dedupeView ? "true" : "false" }} />
            <FacetFilter entity="alumni" field="graduationYear" label="ปีที่สำเร็จการศึกษา" selected={filters.graduationYear ?? []} onChange={(v) => setFilter("graduationYear", v)} queryParams={{ dedupe: dedupeView ? "true" : "false" }} />
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
                    <th className="w-16 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      ลำดับ
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("studentId")}>
                      รหัสนักศึกษา {renderSortIcon("studentId")}
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("cohort")}>
                      รุ่น {renderSortIcon("cohort")}
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("prefix")}>
                      คำนำหน้า {renderSortIcon("prefix")}
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("firstName")}>
                      ชื่อ {renderSortIcon("firstName")}
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("lastName")}>
                      นามสกุล {renderSortIcon("lastName")}
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("degreeLevel")}>
                      ระดับการศึกษา {renderSortIcon("degreeLevel")}
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("major")}>
                      สาขาวิชา {renderSortIcon("major")}
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("graduationYear")}>
                      ปีสำเร็จการศึกษา {renderSortIcon("graduationYear")}
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("birthDate")}>
                      วันเกิด {renderSortIcon("birthDate")}
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap hover:bg-white/10" onClick={() => handleSort("remarks")}>
                      หมายเหตุ {renderSortIcon("remarks")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-12 text-center">
                        <div className="flex justify-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                        </div>
                      </td>
                    </tr>
                  ) : alumni.length === 0 ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-4 py-12 text-center text-[var(--muted)]"
                      >
                        ไม่พบข้อมูล
                      </td>
                    </tr>
                  ) : (
                    alumni.map((a, idx) => (
                      <tr
                        key={`${a.id}-${a.studentId}`}
                        onClick={() => { if (selectMode) toggleSelect(a.id); else router.push(`/management/alumni/${a.id}`); }}
                        className={`cursor-pointer border-b border-[var(--border)] transition-colors ${isSelected(a.id) ? "bg-orange-100 hover:bg-orange-200" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-4 py-3 text-center">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3">{a.studentId}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          <OrangeCell resourceType="alumni" recordId={a.id} field="cohort" value={a.cohort || "-"} hotFields={hot[a.id]} />
                        </td>
                        <td className="px-4 py-3"><OrangeCell resourceType="alumni" recordId={a.id} field="prefix" value={a.prefix} hotFields={hot[a.id]} /></td>
                        <td className="px-4 py-3"><OrangeCell resourceType="alumni" recordId={a.id} field="firstName" value={a.firstName} hotFields={hot[a.id]} /></td>
                        <td className="px-4 py-3"><OrangeCell resourceType="alumni" recordId={a.id} field="lastName" value={a.lastName} hotFields={hot[a.id]} /></td>
                        <td className="px-4 py-3">
                          <OrangeCell resourceType="alumni" recordId={a.id} field="degreeLevel" value={a.degreeLevel ? (DEGREE_LEVEL_LABELS[a.degreeLevel] ?? a.degreeLevel) : "-"} hotFields={hot[a.id]} />
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {a.major || "-"}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {a.graduationYear || "-"}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)] whitespace-nowrap">
                          {formatBirthDateThai(a.birthDate) || "-"}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          <OrangeCell resourceType="alumni" recordId={a.id} field="remarks" value={a.remarks || "-"} hotFields={hot[a.id]} />
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
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

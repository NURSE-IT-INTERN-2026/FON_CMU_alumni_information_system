"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DEGREE_OPTIONS, DEGREE_LABELS, PAGE_SIZE } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Alumni {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  degreeLevel: string;
  initialYear: number;
  graduationYear: number;
  email: string | null;
  phone: string | null;
  currentWorkplace: string | null;
  country: string | null;
  isPotential: boolean;
  isModelRepresentative: boolean;
  expertise: string | null;
  achievementSummary: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AlumniFormData {
  studentId: string;
  firstName: string;
  lastName: string;
  degreeLevel: string;
  initialYear: string;
  graduationYear: string;
  email: string;
  phone: string;
  currentWorkplace: string;
  country: string;
  isPotential: boolean;
  isModelRepresentative: boolean;
  expertise: string;
  achievementSummary: string;
}

type ModalMode = "closed" | "create" | "edit";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

const EMPTY_FORM: AlumniFormData = {
  studentId: "",
  firstName: "",
  lastName: "",
  degreeLevel: "BACHELOR",
  initialYear: "",
  graduationYear: "",
  email: "",
  phone: "",
  currentWorkplace: "",
  country: "",
  isPotential: false,
  isModelRepresentative: false,
  expertise: "",
  achievementSummary: "",
};

type SortField =
  | "studentId"
  | "firstName"
  | "lastName"
  | "degreeLevel"
  | "initialYear"
  | "graduationYear"
  | "createdAt";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AlumniAdminPage() {
  /* ---- state ---- */
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [degreeFilter, setDegreeFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [modalMode, setModalMode] = useState<ModalMode>("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AlumniFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const pageSize = PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /* ---- fetch ---- */

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortField,
        sortOrder,
      });
      if (search.trim()) params.set("search", search.trim());
      if (degreeFilter) params.set("degreeLevel", degreeFilter);

      const res = await fetch(`/api/alumni?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAlumni(json.data);
      setTotal(json.total);
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, degreeFilter, sortField, sortOrder]);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  /* ---- helpers ---- */

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  const rowNumber = (index: number) => (page - 1) * pageSize + index + 1;

  /* ---- search ---- */

  const handleSearch = () => {
    setPage(1);
    fetchAlumni();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  /* ---- modal ---- */

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingId(null);
    setModalMode("create");
  };

  const openEdit = (a: Alumni) => {
    setForm({
      studentId: a.studentId,
      firstName: a.firstName,
      lastName: a.lastName,
      degreeLevel: a.degreeLevel,
      initialYear: String(a.initialYear),
      graduationYear: String(a.graduationYear),
      email: a.email || "",
      phone: a.phone || "",
      currentWorkplace: a.currentWorkplace || "",
      country: a.country || "",
      isPotential: a.isPotential,
      isModelRepresentative: a.isModelRepresentative,
      expertise: a.expertise || "",
      achievementSummary: a.achievementSummary || "",
    });
    setFormErrors({});
    setEditingId(a.id);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode("closed");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.studentId.trim()) errors.studentId = "กรุณากรอกรหัสนักศึกษา";
    if (!form.firstName.trim()) errors.firstName = "กรุณากรอกชื่อ";
    if (!form.lastName.trim()) errors.lastName = "กรุณากรอกนามสกุล";
    if (!form.degreeLevel) errors.degreeLevel = "กรุณาเลือกระดับปริญญา";
    if (!form.initialYear) errors.initialYear = "กรุณากรอกปีที่เข้าศึกษา";
    if (!form.graduationYear) errors.graduationYear = "กรุณากรอกปีที่จบ";
    if (form.initialYear && isNaN(Number(form.initialYear)))
      errors.initialYear = "ปีที่เข้าศึกษาต้องเป็นตัวเลข";
    if (form.graduationYear && isNaN(Number(form.graduationYear)))
      errors.graduationYear = "ปีที่จบต้องเป็นตัวเลข";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const payload = {
        ...form,
        initialYear: Number(form.initialYear),
        graduationYear: Number(form.graduationYear),
      };

      const res =
        modalMode === "create"
          ? await fetch("/api/alumni", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/alumni/${editingId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }

      closeModal();
      fetchAlumni();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  /* ---- delete ---- */

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/alumni/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchAlumni();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setDeleting(false);
    }
  };

  /* ---- export ---- */

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (degreeFilter) params.set("degreeLevel", degreeFilter);

      const res = await fetch(`/api/alumni/export?${params}`);
      if (!res.ok) throw new Error();

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alumni_export.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการส่งออกข้อมูล");
    }
  };

  /* ---- import ---- */

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/alumni/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      setImportResult(data);
      fetchAlumni();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
    } finally {
      setImporting(false);
    }
  };

  const closeImport = () => {
    setShowImport(false);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ---- pagination display ---- */

  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);

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

  /* ================================================================== */
  /*  RENDER                                                             */
  /* ================================================================== */

  return (
    <div className="space-y-6">
      {/* ---- Error toast ---- */}
      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg("")}
            className="ml-4 text-red-500 hover:text-red-700 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1
          className="text-2xl font-bold"
          style={{ color: "#1e3a5f" }}
        >
          จัดการข้อมูลศิษย์เก่า
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "#1e3a5f" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#2c5282")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#1e3a5f")
            }
          >
            <PlusIcon /> เพิ่มข้อมูล
          </button>
          <button
            onClick={() => {
              setImportResult(null);
              setShowImport(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <UploadIcon /> นำเข้า Excel
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <DownloadIcon /> ส่งออก Excel
          </button>
        </div>
      </div>

      {/* ---- Filter bar ---- */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="ค้นหาชื่อ, รหัสนักศึกษา, สถานที่ทำงาน..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={degreeFilter}
            onChange={(e) => {
              setDegreeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">ทุกระดับปริญญา</option>
            {DEGREE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            className="rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "#1e3a5f" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#2c5282")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#1e3a5f")
            }
          >
            ค้นหา
          </button>
        </div>
      </div>

      {/* ---- Data table ---- */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-white text-left"
                style={{ backgroundColor: "#1e3a5f" }}
              >
                <Th className="w-12 rounded-tl-xl">ลำดับ</Th>
                <Th sortable onClick={() => handleSort("studentId")}>
                  รหัสนักศึกษา{sortIndicator("studentId")}
                </Th>
                <Th sortable onClick={() => handleSort("firstName")}>
                  ชื่อ{sortIndicator("firstName")}
                </Th>
                <Th sortable onClick={() => handleSort("lastName")}>
                  นามสกุล{sortIndicator("lastName")}
                </Th>
                <Th sortable onClick={() => handleSort("degreeLevel")}>
                  ระดับปริญญา{sortIndicator("degreeLevel")}
                </Th>
                <Th sortable onClick={() => handleSort("initialYear")}>
                  ปีที่เข้าศึกษา{sortIndicator("initialYear")}
                </Th>
                <Th sortable onClick={() => handleSort("graduationYear")}>
                  ปีที่จบ{sortIndicator("graduationYear")}
                </Th>
                <Th>อีเมล</Th>
                <Th>เบอร์โทร</Th>
                <Th>สถานที่ทำงาน</Th>
                <Th>ประเทศ</Th>
                <Th className="rounded-tr-xl text-center w-28">จัดการ</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner />
                      <span className="text-gray-500">กำลังโหลด...</span>
                    </div>
                  </td>
                </tr>
              ) : alumni.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="py-16 text-center text-gray-400"
                  >
                    ไม่พบข้อมูลศิษย์เก่า
                  </td>
                </tr>
              ) : (
                alumni.map((a, i) => (
                  <tr
                    key={a.id}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-center text-gray-500">
                      {rowNumber(i)}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {a.studentId}
                    </td>
                    <td className="px-4 py-3">{a.firstName}</td>
                    <td className="px-4 py-3">{a.lastName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                        {DEGREE_LABELS[a.degreeLevel] || a.degreeLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{a.initialYear}</td>
                    <td className="px-4 py-3 text-center">{a.graduationYear}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                      {a.email || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.phone || "-"}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">
                      {a.currentWorkplace || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {a.country || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(a)}
                          className="rounded p-1.5 text-blue-600 hover:bg-blue-100 transition-colors"
                          title="แก้ไข"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => setDeleteId(a.id)}
                          className="rounded p-1.5 text-red-500 hover:bg-red-100 transition-colors"
                          title="ลบ"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ---- Pagination ---- */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
          <span className="text-sm text-gray-500">
            แสดง {pageStart}-{pageEnd} จาก {total} รายการ
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ก่อนหน้า
            </button>
            {paginationNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`dot-${i}`} className="px-2 text-gray-400">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    page === p
                      ? "text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                  style={page === p ? { backgroundColor: "#1e3a5f" } : {}}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  CREATE / EDIT MODAL                                              */}
      {/* ================================================================ */}
      {modalMode !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div
              className="flex items-center justify-between rounded-t-2xl px-6 py-4 text-white"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              <h2 className="text-lg font-semibold">
                {modalMode === "create"
                  ? "เพิ่มข้อมูลศิษย์เก่า"
                  : "แก้ไขข้อมูลศิษย์เก่า"}
              </h2>
              <button
                onClick={closeModal}
                className="text-white/70 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Row: studentId */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="รหัสนักศึกษา *"
                  error={formErrors.studentId}
                >
                  <input
                    type="text"
                    value={form.studentId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, studentId: e.target.value }))
                    }
                    className={inputClass(formErrors.studentId)}
                  />
                </Field>
                <Field label="ระดับปริญญา *" error={formErrors.degreeLevel}>
                  <select
                    value={form.degreeLevel}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, degreeLevel: e.target.value }))
                    }
                    className={inputClass(formErrors.degreeLevel)}
                  >
                    {DEGREE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Row: name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ชื่อ *" error={formErrors.firstName}>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    className={inputClass(formErrors.firstName)}
                  />
                </Field>
                <Field label="นามสกุล *" error={formErrors.lastName}>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    className={inputClass(formErrors.lastName)}
                  />
                </Field>
              </div>

              {/* Row: years */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="ปีที่เข้าศึกษา (พ.ศ.) *"
                  error={formErrors.initialYear}
                >
                  <input
                    type="number"
                    value={form.initialYear}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, initialYear: e.target.value }))
                    }
                    placeholder="เช่น 2568"
                    className={inputClass(formErrors.initialYear)}
                  />
                </Field>
                <Field
                  label="ปีที่จบ (พ.ศ.) *"
                  error={formErrors.graduationYear}
                >
                  <input
                    type="number"
                    value={form.graduationYear}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        graduationYear: e.target.value,
                      }))
                    }
                    placeholder="เช่น 2571"
                    className={inputClass(formErrors.graduationYear)}
                  />
                </Field>
              </div>

              {/* Row: contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="อีเมล">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className={inputClass()}
                  />
                </Field>
                <Field label="เบอร์โทร">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className={inputClass()}
                  />
                </Field>
              </div>

              {/* Row: workplace / country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="สถานที่ทำงาน">
                  <input
                    type="text"
                    value={form.currentWorkplace}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        currentWorkplace: e.target.value,
                      }))
                    }
                    className={inputClass()}
                  />
                </Field>
                <Field label="ประเทศ">
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, country: e.target.value }))
                    }
                    className={inputClass()}
                  />
                </Field>
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPotential}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        isPotential: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  ศักยภาพศิษย์เก่า
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isModelRepresentative}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        isModelRepresentative: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  ศิษย์เก่าแบบอย่าง
                </label>
              </div>

              {/* Textareas */}
              <Field label="ความเชี่ยวชาญ">
                <textarea
                  value={form.expertise}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expertise: e.target.value }))
                  }
                  rows={3}
                  className={inputClass()}
                />
              </Field>
              <Field label="สรุปผลงาน/ความสำเร็จ">
                <textarea
                  value={form.achievementSummary}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      achievementSummary: e.target.value,
                    }))
                  }
                  rows={3}
                  className={inputClass()}
                />
              </Field>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#1e3a5f" }}
                onMouseEnter={(e) =>
                  !saving &&
                  (e.currentTarget.style.backgroundColor = "#2c5282")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#1e3a5f")
                }
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  DELETE CONFIRMATION DIALOG                                        */}
      {/* ================================================================ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <TrashIcon />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                ยืนยันการลบข้อมูล
              </h3>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              คุณต้องการลบข้อมูลศิษย์เก่านี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "กำลังลบ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  IMPORT DIALOG                                                     */}
      {/* ================================================================ */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div
              className="flex items-center justify-between rounded-t-2xl px-6 py-4 text-white"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              <h2 className="text-lg font-semibold">นำเข้าข้อมูล Excel</h2>
              <button
                onClick={closeImport}
                className="text-white/70 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  เลือกไฟล์ Excel (.xlsx)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
                />
              </div>

              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#1e3a5f" }}
                onMouseEnter={(e) =>
                  !importing &&
                  (e.currentTarget.style.backgroundColor = "#2c5282")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#1e3a5f")
                }
              >
                {importing ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
              </button>

              {/* Import results */}
              {importResult && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                  <h4 className="font-medium text-gray-800">ผลการนำเข้า</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-green-50 p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {importResult.imported}
                      </div>
                      <div className="text-green-700">นำเข้าสำเร็จ</div>
                    </div>
                    <div className="rounded-lg bg-yellow-50 p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {importResult.skipped}
                      </div>
                      <div className="text-yellow-700">ข้าม (ซ้ำ)</div>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-red-600 mb-1">
                        ข้อผิดพลาด ({importResult.errors.length} รายการ)
                      </p>
                      <div className="max-h-40 overflow-y-auto rounded border border-red-200 bg-white">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-red-50 text-red-700">
                              <th className="px-3 py-1.5 text-left">แถวที่</th>
                              <th className="px-3 py-1.5 text-left">รายละเอียด</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100">
                            {importResult.errors.map((err, i) => (
                              <tr key={i}>
                                <td className="px-3 py-1.5">{err.row}</td>
                                <td className="px-3 py-1.5">{err.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-gray-100 px-6 py-4">
              <button
                onClick={closeImport}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Sub-components & helpers                                           */
/* ================================================================== */

/* Table header cell */
function Th({
  children,
  className = "",
  sortable = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${
        sortable ? "cursor-pointer select-none hover:bg-white/10" : ""
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </th>
  );
}

/* Form field wrapper */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* Input className helper */
function inputClass(error?: string) {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
    error ? "border-red-400" : "border-gray-300"
  }`;
}

/* Loading spinner */
function Spinner() {
  return (
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
  );
}

/* ---- Inline SVG icons ---- */

function PlusIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function UploadIcon() {
  return (
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
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
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
  );
}

function PencilIcon() {
  return (
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
  );
}

function TrashIcon() {
  return (
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
  );
}
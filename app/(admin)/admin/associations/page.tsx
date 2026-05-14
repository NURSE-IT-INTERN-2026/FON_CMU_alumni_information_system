"use client";

import { useState, useEffect, useCallback } from "react";
import { PAGE_SIZE } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Association {
  id: string;
  studentId: string;
  fullName: string;
  associationName: string;
  position: string;
  recordedYear: number;
  createdAt: string;
  updatedAt: string;
}

interface AssociationFormData {
  studentId: string;
  fullName: string;
  associationName: string;
  position: string;
  recordedYear: string;
}

type ModalMode = "closed" | "create" | "edit";

const EMPTY_FORM: AssociationFormData = {
  studentId: "",
  fullName: "",
  associationName: "",
  position: "",
  recordedYear: "",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AssociationsAdminPage() {
  const [items, setItems] = useState<Association[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"studentId" | "fullName" | "recordedYear" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [modalMode, setModalMode] = useState<ModalMode>("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssociationFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* ---- fetch ---- */

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortField,
        sortOrder,
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/associations?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(json.data);
      setTotal(json.total);
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoading(false);
    }
  }, [page, search, sortField, sortOrder]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /* ---- helpers ---- */

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const sortIndicator = (field: typeof sortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  const rowNumber = (index: number) => (page - 1) * PAGE_SIZE + index + 1;

  const handleSearch = () => {
    setPage(1);
    fetchItems();
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

  const openEdit = (item: Association) => {
    setForm({
      studentId: item.studentId,
      fullName: item.fullName,
      associationName: item.associationName,
      position: item.position,
      recordedYear: String(item.recordedYear),
    });
    setFormErrors({});
    setEditingId(item.id);
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
    if (!form.fullName.trim()) errors.fullName = "กรุณากรอกชื่อ-สกุล";
    if (!form.associationName.trim()) errors.associationName = "กรุณากรอกชื่อสมาคม/ชมรม";
    if (!form.position.trim()) errors.position = "กรุณากรอกตำแหน่ง";
    if (!form.recordedYear) errors.recordedYear = "กรุณากรอกปีที่บันทึก";
    if (form.recordedYear && isNaN(Number(form.recordedYear)))
      errors.recordedYear = "ปีที่บันทึกต้องเป็นตัวเลข";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const payload = { ...form, recordedYear: Number(form.recordedYear) };

      const res =
        modalMode === "create"
          ? await fetch("/api/associations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/associations/${editingId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }

      closeModal();
      fetchItems();
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
      const res = await fetch(`/api/associations/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchItems();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setDeleting(false);
    }
  };

  /* ---- pagination display ---- */

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

  /* ================================================================== */
  /*  RENDER                                                             */
  /* ================================================================== */

  return (
    <div className="space-y-6">
      {/* Error toast */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold" style={{ color: "#1e3a5f" }}>
          จัดการข้อมูลสมาคม/ชมรม
        </h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#1e3a5f" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2c5282")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1e3a5f")}
        >
          <PlusIcon /> เพิ่มข้อมูล
        </button>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="ค้นหารหัสนักศึกษา, ชื่อ-สกุล, สมาคม/ชมรม, ตำแหน่ง..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            className="rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "#1e3a5f" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2c5282")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1e3a5f")}
          >
            ค้นหา
          </button>
        </div>
      </div>

      {/* Data table */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white text-left" style={{ backgroundColor: "#1e3a5f" }}>
                <Th className="w-12 rounded-tl-xl">ลำดับ</Th>
                <Th sortable onClick={() => handleSort("studentId")}>
                  รหัสนักศึกษา{sortIndicator("studentId")}
                </Th>
                <Th sortable onClick={() => handleSort("fullName")}>
                  ชื่อ-สกุล{sortIndicator("fullName")}
                </Th>
                <Th>ชื่อสมาคม/ชมรม</Th>
                <Th>ตำแหน่ง</Th>
                <Th sortable onClick={() => handleSort("recordedYear")}>
                  ปีที่บันทึก{sortIndicator("recordedYear")}
                </Th>
                <Th className="rounded-tr-xl text-center w-28">จัดการ</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner />
                      <span className="text-gray-500">กำลังโหลด...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400">
                    ไม่พบข้อมูลสมาคม/ชมรม
                  </td>
                </tr>
              ) : (
                items.map((item, i) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3 text-center text-gray-500">{rowNumber(i)}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{item.studentId}</td>
                    <td className="px-4 py-3">{item.fullName}</td>
                    <td className="px-4 py-3">{item.associationName}</td>
                    <td className="px-4 py-3">{item.position}</td>
                    <td className="px-4 py-3 text-center">{item.recordedYear}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="rounded p-1.5 text-blue-600 hover:bg-blue-100 transition-colors"
                          title="แก้ไข"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
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

        {/* Pagination */}
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
                <span key={`dot-${i}`} className="px-2 text-gray-400">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    page === p ? "text-white" : "text-gray-600 hover:bg-gray-50"
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

      {/* CREATE / EDIT MODAL */}
      {modalMode !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div
              className="flex items-center justify-between rounded-t-2xl px-6 py-4 text-white"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              <h2 className="text-lg font-semibold">
                {modalMode === "create" ? "เพิ่มข้อมูลสมาคม/ชมรม" : "แก้ไขข้อมูลสมาคม/ชมรม"}
              </h2>
              <button
                onClick={closeModal}
                className="text-white/70 hover:text-white text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <Field label="รหัสนักศึกษา *" error={formErrors.studentId}>
                <input
                  type="text"
                  value={form.studentId}
                  onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                  className={inputClass(formErrors.studentId)}
                />
              </Field>

              <Field label="ชื่อ-สกุล *" error={formErrors.fullName}>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={inputClass(formErrors.fullName)}
                />
              </Field>

              <Field label="ชื่อสมาคม/ชมรม *" error={formErrors.associationName}>
                <input
                  type="text"
                  value={form.associationName}
                  onChange={(e) => setForm((f) => ({ ...f, associationName: e.target.value }))}
                  className={inputClass(formErrors.associationName)}
                />
              </Field>

              <Field label="ตำแหน่ง *" error={formErrors.position}>
                <input
                  type="text"
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  className={inputClass(formErrors.position)}
                />
              </Field>

              <Field label="ปีที่บันทึก (พ.ศ.) *" error={formErrors.recordedYear}>
                <input
                  type="number"
                  value={form.recordedYear}
                  onChange={(e) => setForm((f) => ({ ...f, recordedYear: e.target.value }))}
                  placeholder="เช่น 2568"
                  className={inputClass(formErrors.recordedYear)}
                />
              </Field>
            </div>

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
                onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = "#2c5282")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1e3a5f")}
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <TrashIcon />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">ยืนยันการลบข้อมูล</h3>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              คุณต้องการลบข้อมูลสมาคม/ชมรมนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components & helpers                                           */
/* ------------------------------------------------------------------ */

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
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputClass(error?: string) {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
    error ? "border-red-400" : "border-gray-300"
  }`;
}

function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />;
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

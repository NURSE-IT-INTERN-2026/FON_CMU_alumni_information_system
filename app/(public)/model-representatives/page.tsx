"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PAGE_SIZE } from "@/lib/constants";

interface ModelRepresentative {
  id: string;
  name: string;
  cohort: string;
  generation: number;
}

interface ApiResponse {
  data: ModelRepresentative[];
}

const COHORT_ORDER = [
  "รายชื่อเครือข่ายศิษย์เก่าผู้ช่วยพยาบาล (รุ่น  1 – 38)",
  "รายชื่อเครือข่ายศิษย์เก่าปริญญาโท (รุ่น  1 – 20)",
  "รายชื่อเครือข่ายศิษย์เก่าอนุปริญญาพยาบาล (รุ่น  1 – 13)",
  "รายชื่อเครือข่ายศิษย์เก่าปริญญาพยาบาล (รุ่น  1 – 38)",
  "รายชื่อเครือข่ายศิษย์เก่าปริญญาเอก (รุ่น  1 – 6)",
];

const EMPTY_FORM = { name: "", cohort: "", generation: "" };

export default function ModelRepresentativesPage() {
  const [alumni, setAlumni] = useState<ModelRepresentative[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pages, setPages] = useState<Record<string, number>>({});
  const [sortDirs, setSortDirs] = useState<Record<string, "asc" | "desc">>({});

  const [manageMode, setManageMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [managePage, setManagePage] = useState(1);

  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !(prev[label] ?? true) }));

  const getPage = (label: string) => pages[label] ?? 1;
  const setPage = (label: string, p: number) =>
    setPages((prev) => ({ ...prev, [label]: p }));
  const getSortDir = (label: string) => sortDirs[label] ?? "asc";
  const toggleSort = (label: string) =>
    setSortDirs((prev) => ({
      ...prev,
      [label]: prev[label] === "asc" ? "desc" : "asc",
    }));

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search });
      const res = await fetch(`/api/model-representatives?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setAlumni(data.data);
      setPages({});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  const grouped = useMemo(() => {
    const byCohort = new Map<string, ModelRepresentative[]>();
    for (const a of alumni) {
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
  }, [alumni]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: ModelRepresentative) => {
    setForm({
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
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "กรุณากรอกชื่อ-นามสกุล";
    if (!form.cohort.trim()) errors.cohort = "กรุณากรอกรุ่น";
    if (!form.generation) errors.generation = "กรุณากรอกลำดับรุ่น";
    if (form.generation && isNaN(Number(form.generation)))
      errors.generation = "ลำดับรุ่นต้องเป็นตัวเลข";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const payload = {
        name: form.name.trim(),
        cohort: form.cohort.trim(),
        generation: Number(form.generation),
      };
      const res = editingId
        ? await fetch(`/api/model-representatives/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/model-representatives", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
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

  const manageTotalPages = Math.max(1, Math.ceil(alumni.length / PAGE_SIZE));
  const currentManagePage = Math.min(managePage, manageTotalPages);
  const manageStart = (currentManagePage - 1) * PAGE_SIZE;
  const managePageItems = alumni.slice(manageStart, manageStart + PAGE_SIZE);
  const managePageStart = alumni.length === 0 ? 0 : manageStart + 1;
  const managePageEnd = Math.min(manageStart + PAGE_SIZE, alumni.length);

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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          รายชื่อเครือข่ายศิษย์เก่าทุกรุ่นทุกหลักสูตร
        </h1>
        {!manageMode ? (
          <button
            onClick={() => setManageMode(true)}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            จัดการข้อมูล
          </button>
        ) : (
          <button
            onClick={() => {
              setManageMode(false);
              setShowForm(false);
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

      {/* Manage mode: create/edit form */}
      {manageMode && showForm && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">
            {editingId ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                รุ่น (cohort) *
              </label>
              <input
                type="text"
                value={form.cohort}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cohort: e.target.value }))
                }
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.cohort ? "border-red-400" : "border-gray-300"}`}
              />
              {formErrors.cohort && (
                <p className="mt-1 text-xs text-red-500">{formErrors.cohort}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ลำดับรุ่น (ตัวเลข) *
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
        <div className="mb-4">
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
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="ค้นหาชื่อหรือรุ่น..."
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
        alumni.length === 0 ? (
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    รุ่นที่
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    ชื่อ-นามสกุล
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
                    <td className="px-4 py-3 text-center text-gray-500">
                      {manageStart + i + 1}
                    </td>
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
                แสดง {managePageStart}-{managePageEnd} จาก {alumni.length}{" "}
                รายการ
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setManagePage(Math.max(1, currentManagePage - 1))}
                  disabled={currentManagePage === 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
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
                      onClick={() => setManagePage(p)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                        currentManagePage === p
                          ? "bg-[var(--primary)] text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() =>
                    setManagePage(Math.min(manageTotalPages, currentManagePage + 1))
                  }
                  disabled={currentManagePage === manageTotalPages}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          </div>
        )
      ) : /* ===== VIEW MODE: sectioned tables by cohort ===== */
      alumni.length === 0 ? (
        <div className="py-12 text-center text-[var(--muted)]">ไม่พบข้อมูล</div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => {
            const isCollapsed = collapsed[group.label] ?? true;
            const sortDir = getSortDir(group.label);
            const sortedItems = [...group.items].sort((a, b) =>
              sortDir === "asc"
                ? a.generation - b.generation
                : b.generation - a.generation
            );
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
                              onClick={() => toggleSort(group.label)}
                            >
                              รุ่นที่ {sortDir === "asc" ? "▲" : "▼"}
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                              ชื่อ - นามสกุล
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
                              <td className="px-4 py-3">{a.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex justify-center gap-2 border-t border-[var(--border)] px-4 py-3">
                        <button
                          onClick={() =>
                            setPage(group.label, Math.max(1, currentPage - 1))
                          }
                          disabled={currentPage === 1}
                          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
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
                                : "border border-[var(--border)] hover:bg-gray-50"
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
                          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          ถัดไป
                        </button>
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
    </div>
  );
}

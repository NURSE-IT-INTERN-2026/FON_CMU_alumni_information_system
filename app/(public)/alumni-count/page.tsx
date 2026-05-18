"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { DEGREE_OPTIONS, DEGREE_LABELS, PAGE_SIZE } from "@/lib/constants";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Dataset {
  degreeLevel: string;
  data: number[];
}

interface ChartData {
  labels: number[];
  datasets: Dataset[];
}

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
}

interface AlumniApiResponse {
  data: Alumni[];
  total: number;
}

const DEGREE_COLORS: Record<string, string> = {
  DOCTORAL: "#1e3a5f",
  MASTER: "#2c5282",
  BACHELOR: "#4299e1",
  NURSING_CERTIFICATE: "#e8a838",
};

const EMPTY_FORM = {
  studentId: "",
  firstName: "",
  lastName: "",
  degreeLevel: "",
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

export default function AlumniCountPage() {
  // View mode state
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [chartLoading, setChartLoading] = useState(true);

  // Manage mode state
  const [manageMode, setManageMode] = useState(false);
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [totalAlumni, setTotalAlumni] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [degreeFilter, setDegreeFilter] = useState("");
  const [tableLoading, setTableLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Fetch chart data
  const fetchChartData = useCallback(async () => {
    setChartLoading(true);
    try {
      const res = await fetch("/api/alumni-count");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ChartData = await res.json();
      setChartData(data);
      const total = data.datasets.reduce(
        (sum, ds) => sum + ds.data.reduce((s, v) => s + v, 0),
        0
      );
      setTotalCount(total);
    } catch (err) {
      console.error(err);
    } finally {
      setChartLoading(false);
    }
  }, []);

  // Fetch alumni table data
  const fetchAlumni = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
        degreeLevel: degreeFilter,
      });
      const res = await fetch(`/api/alumni?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: AlumniApiResponse = await res.json();
      setAlumni(data.data);
      setTotalAlumni(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
    }
  }, [page, search, degreeFilter]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  useEffect(() => {
    if (manageMode) {
      fetchAlumni();
    }
  }, [manageMode, fetchAlumni]);

  const totalPages = Math.max(1, Math.ceil(totalAlumni / PAGE_SIZE));

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleDegreeFilter = (value: string) => {
    setDegreeFilter(value);
    setPage(1);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingId(null);
    setShowForm(true);
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
    if (!form.studentId.trim()) errors.studentId = "กรุณากรอกรหัสนักศึกษา";
    if (!form.firstName.trim()) errors.firstName = "กรุณากรอกชื่อ";
    if (!form.lastName.trim()) errors.lastName = "กรุณากรอกนามสกุล";
    if (!form.degreeLevel) errors.degreeLevel = "กรุณาเลือกระดับปริญญา";
    if (!form.initialYear) errors.initialYear = "กรุณากรอกปีที่เข้าศึกษา";
    if (!form.graduationYear) errors.graduationYear = "กรุณากรอกปีที่จบ";
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
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        degreeLevel: form.degreeLevel,
        initialYear: Number(form.initialYear),
        graduationYear: Number(form.graduationYear),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        currentWorkplace: form.currentWorkplace.trim() || null,
        country: form.country.trim() || null,
        isPotential: form.isPotential,
        isModelRepresentative: form.isModelRepresentative,
        expertise: form.expertise.trim() || null,
        achievementSummary: form.achievementSummary.trim() || null,
      };
      const res = editingId
        ? await fetch(`/api/alumni/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/alumni", {
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
      fetchChartData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/alumni/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchAlumni();
      fetchChartData();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const enterManageMode = () => {
    setManageMode(true);
    setPage(1);
    setSearch("");
    setDegreeFilter("");
    setShowForm(false);
  };

  const exitManageMode = () => {
    setManageMode(false);
    setShowForm(false);
    setEditingId(null);
    setErrorMsg("");
  };

  const handleExport = () => {
    window.location.href = "/api/alumni/export";
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/alumni/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      setImportResult(data);
      fetchAlumni();
      fetchChartData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้า");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  // Chart rendering (view mode)
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "จำนวนนักศึกษาเก่าตามปีที่เข้าศึกษา",
        font: { size: 18 },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "ปีที่เข้าศึกษา (พ.ศ.)",
        },
      },
      y: {
        title: {
          display: true,
          text: "จำนวน (คน)",
        },
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  // View mode loading
  if (!manageMode && chartLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  // View mode error
  if (!manageMode && !chartData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 text-center">
        <p className="text-[var(--muted)]">ไม่สามารถโหลดข้อมูลได้</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          จำนวนนักศึกษาเก่าตามปีที่เข้าศึกษา
        </h1>
        {!manageMode ? (
          <button
            onClick={enterManageMode}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            จัดการข้อมูล
          </button>
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

      {manageMode ? (
        <>
          {/* Create/Edit form */}
          {showForm && (
            <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">
                {editingId ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                      formErrors.studentId ? "border-red-400" : "border-gray-300"
                    }`}
                  />
                  {formErrors.studentId && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.studentId}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    ชื่อ *
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                      formErrors.firstName ? "border-red-400" : "border-gray-300"
                    }`}
                  />
                  {formErrors.firstName && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    นามสกุล *
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                      formErrors.lastName ? "border-red-400" : "border-gray-300"
                    }`}
                  />
                  {formErrors.lastName && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.lastName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    ระดับปริญญา *
                  </label>
                  <select
                    value={form.degreeLevel}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, degreeLevel: e.target.value }))
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                      formErrors.degreeLevel ? "border-red-400" : "border-gray-300"
                    }`}
                  >
                    <option value="">-- เลือกระดับปริญญา --</option>
                    {DEGREE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.degreeLevel && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.degreeLevel}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    ปีที่เข้าศึกษา (พ.ศ.) *
                  </label>
                  <input
                    type="number"
                    value={form.initialYear}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, initialYear: e.target.value }))
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                      formErrors.initialYear ? "border-red-400" : "border-gray-300"
                    }`}
                  />
                  {formErrors.initialYear && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.initialYear}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    ปีที่จบ (พ.ศ.) *
                  </label>
                  <input
                    type="number"
                    value={form.graduationYear}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        graduationYear: e.target.value,
                      }))
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                      formErrors.graduationYear
                        ? "border-red-400"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.graduationYear && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.graduationYear}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    อีเมล
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    เบอร์โทร
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    สถานที่ทำงาน
                  </label>
                  <input
                    type="text"
                    value={form.currentWorkplace}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        currentWorkplace: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    ประเทศ
                  </label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, country: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div className="flex items-center gap-6 sm:col-span-2 lg:col-span-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.isPotential}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          isPotential: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    ศักยภาพ
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.isModelRepresentative}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          isModelRepresentative: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    ผู้แทนรุ่น
                  </label>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    ความเชี่ยวชาญ
                  </label>
                  <textarea
                    value={form.expertise}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, expertise: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    สรุปผลงาน
                  </label>
                  <textarea
                    value={form.achievementSummary}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        achievementSummary: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
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

          {/* Add button */}
          {!showForm && (
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
            </div>
          )}

          {/* Filters */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัสนักศึกษา..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            <select
              value={degreeFilter}
              onChange={(e) => handleDegreeFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="">ทุกระดับปริญญา</option>
              {DEGREE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Alumni table */}
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white text-left" style={{ backgroundColor: "#1e3a5f" }}>
                    <th className="w-16 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      ลำดับ
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      รหัสนักศึกษา
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      ชื่อ
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      นามสกุล
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      ระดับปริญญา
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      ปีที่เข้าศึกษา
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      ปีที่จบ
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      อีเมล
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      เบอร์โทร
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      สถานที่ทำงาน
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center">
                        <div className="flex justify-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                        </div>
                      </td>
                    </tr>
                  ) : alumni.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
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
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3">{a.studentId}</td>
                        <td className="px-4 py-3">{a.firstName}</td>
                        <td className="px-4 py-3">{a.lastName}</td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-block rounded-full px-3 py-1 text-xs font-medium text-white"
                            style={{
                              backgroundColor:
                                DEGREE_COLORS[a.degreeLevel] || "#999",
                            }}
                          >
                            {DEGREE_LABELS[a.degreeLevel] || a.degreeLevel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">{a.initialYear}</td>
                        <td className="px-4 py-3 text-center">
                          {a.graduationYear}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {a.email || "-"}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {a.phone || "-"}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {a.currentWorkplace || "-"}
                        </td>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 border-t border-[var(--border)] px-4 py-3">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  ก่อนหน้า
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`rounded-md px-3 py-1.5 text-sm ${
                        page === p
                          ? "bg-[var(--primary)] text-white"
                          : "border border-[var(--border)] hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  ถัดไป
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* View mode: chart and breakdown */
        <div className="overflow-hidden rounded-lg bg-white p-4 shadow-sm sm:p-6">
          <div className="h-[500px]">
            <Line
              data={{
                labels: chartData!.labels.map((y) => String(y)),
                datasets: chartData!.datasets.map((ds) => ({
                  label: DEGREE_LABELS[ds.degreeLevel] || ds.degreeLevel,
                  data: ds.data,
                  borderColor: DEGREE_COLORS[ds.degreeLevel] || "#999",
                  backgroundColor: DEGREE_COLORS[ds.degreeLevel] || "#999",
                  tension: 0.3,
                })),
              }}
              options={chartOptions}
            />
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <p className="mb-4 text-center text-lg font-semibold text-[var(--primary)]">
              จำนวนนักศึกษาเก่าทั้งหมด: {totalCount.toLocaleString()} คน
            </p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {chartData!.datasets.map((ds) => {
                const count = ds.data.reduce((s, v) => s + v, 0);
                return (
                  <div
                    key={ds.degreeLevel}
                    className="rounded-lg border border-[var(--border)] p-4 text-center"
                  >
                    <div
                      className="mx-auto mb-2 h-3 w-12 rounded-full"
                      style={{
                        backgroundColor:
                          DEGREE_COLORS[ds.degreeLevel] || "#999",
                      }}
                    />
                    <p className="text-sm text-[var(--muted)]">
                      {DEGREE_LABELS[ds.degreeLevel] || ds.degreeLevel}
                    </p>
                    <p className="text-2xl font-bold text-[var(--primary)]">
                      {count.toLocaleString()}
                    </p>
                    <p className="text-sm text-[var(--muted)]">คน</p>
                  </div>
                );
              })}
            </div>
          </div>
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCanWrite } from "@/lib/role-context";
import { DEGREE_LEVEL_OPTIONS } from "@/lib/constants";

/* ───── Admin User types & tab ───── */
interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  role: "admin",
};

/* ───── Alumni Account types ───── */
interface AlumniAccount {
  id: string;
  studentId: string;
  prefix: string;
  firstName: string;
  maidenLastName: string;
  newLastName: string | null;
  cohort: string | null;
  degreeLevel: string;
  email: string | null;
  phone: string | null;
  lastLoginAt: string | null;
}

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
  ASSOCIATE: "อนุปริญญา",
};

export default function UsersPage() {
  const canWrite = useCanWrite();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"admin" | "alumni">("admin");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          จัดการผู้ใช้งาน
        </h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab("admin")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "admin"
              ? "bg-white text-[var(--primary)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          บัญชีผู้ดูแลระบบ/ผู้บริหาร
        </button>
        <button
          onClick={() => setActiveTab("alumni")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "alumni"
              ? "bg-white text-[var(--primary)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          บัญชีศิษย์เก่า
        </button>
      </div>

      {activeTab === "admin" ? (
        <AdminAccountsTab canWrite={canWrite} />
      ) : (
        <AlumniAccountsTab canWrite={canWrite} router={router} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Admin Accounts Tab (existing members logic)
   ═══════════════════════════════════════════ */
function AdminAccountsTab({ canWrite }: { canWrite: boolean }) {
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMembers(data);
    } catch {
      setErrorMsg("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = "กรุณากรอกชื่อ";
    if (!form.lastName.trim()) errors.lastName = "กรุณากรอกนามสกุล";
    if (!form.email.trim()) errors.email = "กรุณากรอกอีเมล";
    else if (!form.email.trim().endsWith("@cmu.ac.th")) errors.email = "กรุณาใช้อีเมล @cmu.ac.th";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreate = () => { setForm(EMPTY_FORM); setFormErrors({}); setEditingId(null); setShowForm(true); };
  const openEdit = (m: AdminUser) => { setForm({ firstName: m.firstName, lastName: m.lastName, email: m.email, role: m.role }); setFormErrors({}); setEditingId(m.id); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setFormErrors({}); };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true); setErrorMsg("");
    try {
      const payload = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), role: form.role };
      const res = editingId
        ? await fetch(`/api/users/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "เกิดข้อผิดพลาด"); }
      closeForm(); fetchMembers();
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"); } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteId(null); fetchMembers();
    } catch { setErrorMsg("เกิดข้อผิดพลาดในการลบข้อมูล"); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });

  const roleBadge = (role: string) => {
    const s: Record<string, string> = { superadmin: "bg-purple-100 text-purple-700", executive: "bg-amber-100 text-amber-700", admin: "bg-purple-100 text-purple-700" };
    const l: Record<string, string> = { superadmin: "ผู้ดูแลระบบสูงสุด", executive: "ผู้บริหาร", admin: "ผู้ดูแลระบบ" };
    return <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${s[role] || "bg-gray-100 text-gray-700"}`}>{l[role] || role}</span>;
  };

  return (
    <>
      {errorMsg && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-4 font-bold text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        {canWrite && (
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 cursor-pointer">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            เพิ่มข้อมูล
          </button>
        )}
      </div>

      {canWrite && showForm && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">{editingId ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อ *</label>
              <input type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.firstName ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.firstName && <p className="mt-1 text-xs text-red-500">{formErrors.firstName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">นามสกุล *</label>
              <input type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.lastName ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.lastName && <p className="mt-1 text-xs text-red-500">{formErrors.lastName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">อีเมล *</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.email ? "border-red-400" : "border-gray-300"}`} />
              {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ตำแหน่ง</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
                <option value="admin">ผู้ดูแลระบบ</option>
                <option value="superadmin">ผู้ดูแลระบบสูงสุด</option>
                <option value="executive">ผู้บริหาร</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={closeForm} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">ยกเลิก</button>
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 cursor-pointer">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white text-left" style={{ backgroundColor: "#5b21b6" }}>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ลำดับ</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ชื่อ-นามสกุล</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">วันที่เพิ่ม</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ตำแหน่ง</th>
                {canWrite && <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap">การจัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 5 : 4} className="px-4 py-12 text-center"><div className="flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div></td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={canWrite ? 5 : 4} className="px-4 py-12 text-center text-[var(--muted)]">ไม่พบข้อมูล</td></tr>
              ) : (
                members.map((m, i) => (
                  <tr key={m.id} className="border-b border-[var(--border)] transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 text-center text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{m.firstName} {m.lastName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(m.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{roleBadge(m.role)}</td>
                    {canWrite && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(m)} className="rounded p-1.5 text-purple-600 hover:bg-purple-100 cursor-pointer" title="แก้ไข">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                          </button>
                          <button onClick={() => setDeleteId(m.id)} className="rounded p-1.5 text-red-500 hover:bg-red-100 cursor-pointer" title="ลบ">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการลบข้อมูล</h3>
            <p className="mb-6 text-sm text-gray-600">คุณต้องการลบข้อมูลสมาชิกนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">ยกเลิก</button>
              <button onClick={confirmDelete} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   Alumni Accounts Tab
   ═══════════════════════════════════════════ */
function AlumniAccountsTab({ canWrite, router }: { canWrite: boolean; router: ReturnType<typeof useRouter> }) {
  const [alumni, setAlumni] = useState<AlumniAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const pageSize = 10;

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/alumni-accounts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAlumni(data.data);
      setTotal(data.total);
    } catch {
      setErrorMsg("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchAlumni(); }, [fetchAlumni]);

  const totalPages = Math.ceil(total / pageSize);
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <>
      {errorMsg && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-4 font-bold text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ค้นหาชื่อ, รหัสนักศึกษา, อีเมล..."
          className="w-full max-w-sm rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
        />
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white text-left" style={{ backgroundColor: "#5b21b6" }}>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ลำดับ</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">รหัสนักศึกษา</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ชื่อ-สกุล</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">รุ่นที่</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ระดับปริญญา</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">อีเมล</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">เบอร์โทรศัพท์</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">เข้าสู่ระบบล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center"><div className="flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div></td></tr>
              ) : alumni.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-[var(--muted)]">ไม่พบข้อมูลศิษย์เก่าที่เคยเข้าสู่ระบบ</td></tr>
              ) : (
                alumni.map((a, i) => (
                  <tr
                    key={a.id}
                    onClick={() => canWrite && router.push(`/settings/alumni/${a.id}`)}
                    className={`border-b border-[var(--border)] transition-colors hover:bg-gray-50 ${canWrite ? "cursor-pointer" : ""}`}
                  >
                    <td className="px-4 py-3 text-center text-gray-500">{(page - 1) * pageSize + i + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.studentId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.prefix}{a.firstName} {a.newLastName || a.maidenLastName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.cohort || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{DEGREE_LABELS[a.degreeLevel] || a.degreeLevel}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.email || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.phone || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(a.lastLoginAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50">ก่อนหน้า</button>
          <span className="text-sm text-[var(--muted)]">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50">ถัดไป</button>
        </div>
      )}
    </>
  );
}

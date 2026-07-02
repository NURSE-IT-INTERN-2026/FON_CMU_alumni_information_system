"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCanWrite, useRole } from "@/lib/role-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { userCreateSchema, type UserCreateInput } from "@/lib/validations";
import type { SignupVerification } from "@/lib/signup-verification";
import { formatBirthDateThaiSlash } from "@/lib/alumni-verify";
import { joinPhones } from "@/lib/parse-phone";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";
import SearchInput from "@/components/ui/search-input";

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

const EMPTY_FORM: UserCreateInput = {
  firstName: "",
  lastName: "",
  email: "",
  role: "admin",
};

/* ───── Alumni Account types ───── */
type AccountStatus = "PENDING" | "ACTIVE" | "REJECTED";

interface AlumniAccount {
  id: string;
  studentId: string;
  prefix: string;
  firstName: string;
  lastName: string;
  newLastName: string | null;
  cohort: string | null;
  degreeLevel: string;
  email: string | null;
  contactEmail: string | null;
  phones: string[];
  lastLoginAt: string | null;
  suspendedAt: string | null;
  accountStatus: AccountStatus;
  createdAt: string;
  signupVerification: SignupVerification | null;
}

const STATUS_LABELS: Record<AccountStatus, string> = {
  PENDING: "รออนุมัติ",
  ACTIVE: "ใช้งาน",
  REJECTED: "ปฏิเสธ",
};
const STATUS_BADGE_CLASSES: Record<AccountStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

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
          บัญชีผู้ดูแลระบบ
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
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const role = useRole();

  const { register, handleSubmit, formState: { errors: formErrors }, reset: formReset } = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema) as unknown as Resolver<UserCreateInput>,
    defaultValues: EMPTY_FORM,
  });

  const qc = useQueryClient();
  const { data: membersData, isPending: loading } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => apiFetch<AdminUser[]>("/api/users"),
  });
  const members = membersData ?? [];

  const openCreate = () => { formReset(EMPTY_FORM); setEditingId(null); setShowForm(true); };
  const openEdit = (m: AdminUser) => { formReset({ firstName: m.firstName, lastName: m.lastName, email: m.email, role: m.role as "superadmin" | "admin" }); setEditingId(m.id); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingId(null); formReset(EMPTY_FORM); };

  const toggleSuspend = async (m: AdminUser) => {
    try {
      await apiFetch(`/api/users/${m.id}`, { method: "PUT", json: { isActive: !m.isActive } });
      qc.invalidateQueries({ queryKey: queryKeys.users.all });
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการดำเนินการ"); }
  };

  const handleSave = async (data: UserCreateInput) => {
    setSaving(true); setErrorMsg("");
    try {
      const payload = { firstName: data.firstName.trim(), lastName: data.lastName.trim(), email: data.email.trim(), role: data.role };
      if (editingId) {
        await apiFetch(`/api/users/${editingId}`, { method: "PUT", json: payload });
      } else {
        await apiFetch(`/api/users`, { method: "POST", json: payload });
      }
      closeForm(); qc.invalidateQueries({ queryKey: queryKeys.users.all });
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"); } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/api/users/${deleteId}`, { method: "DELETE" });
      setDeleteId(null); qc.invalidateQueries({ queryKey: queryKeys.users.all });
    } catch { setErrorMsg("เกิดข้อผิดพลาดในการลบข้อมูล"); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });

  const roleBadge = (role: string) => {
    const s: Record<string, string> = { superadmin: "bg-purple-100 text-purple-700", admin: "bg-purple-100 text-purple-700" };
    const l: Record<string, string> = { superadmin: "ผู้ดูแลระบบสูงสุด", admin: "ผู้ดูแลระบบ" };
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
            <FormField label="ชื่อ" required error={formErrors.firstName?.message}>
              <FormInput registration={register("firstName")} error={formErrors.firstName?.message} type="text" />
            </FormField>
            <FormField label="นามสกุล" required error={formErrors.lastName?.message}>
              <FormInput registration={register("lastName")} error={formErrors.lastName?.message} type="text" />
            </FormField>
            <FormField label="อีเมล" required error={formErrors.email?.message}>
              <FormInput registration={register("email")} error={formErrors.email?.message} type="email" />
            </FormField>
            <FormField label="ตำแหน่ง">
              <FormSelect registration={register("role")}>
                <option value="admin">ผู้ดูแลระบบ</option>
                <option value="superadmin">ผู้ดูแลระบบสูงสุด</option>
              </FormSelect>
            </FormField>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={closeForm} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">ยกเลิก</button>
            <button type="button" onClick={handleSubmit(handleSave)} disabled={saving} className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 cursor-pointer">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
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
                          {role === "superadmin" && (
                            <button onClick={() => toggleSuspend(m)} className={`rounded p-1.5 hover:bg-gray-100 cursor-pointer ${m.isActive ? "text-amber-600" : "text-green-600"}`} title={m.isActive ? "ระงับบัญชี" : "ยกเลิกการระงับ"}>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            </button>
                          )}
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
  const [errorMsg, setErrorMsg] = useState("");
  const [emailEdit, setEmailEdit] = useState<AlumniAccount | null>(null);
  const [emailValue, setEmailValue] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [reviewAccount, setReviewAccount] = useState<AlumniAccount | null>(null);
  const [reviewActioning, setReviewActioning] = useState(false);

  const pageSize = 10;

  const qc = useQueryClient();
  const { data: alumniData, isPending: loading } = useQuery({
    queryKey: ["alumniAccounts", "list", { page, search, statusFilter }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      return apiFetch<{ data: AlumniAccount[]; total: number }>(`/api/alumni-accounts?${params}`);
    },
  });
  const alumni = alumniData?.data ?? [];
  const total = alumniData?.total ?? 0;

  // Pending-approval count (independent of the list's status filter) so the
  // admin always sees what needs attention.
  const { data: pendingData } = useQuery({
    queryKey: ["alumniAccounts", "pendingCount"],
    queryFn: () =>
      apiFetch<{ total: number }>(`/api/alumni-accounts?status=pending&pageSize=1`),
  });
  const pendingCount = pendingData?.total ?? 0;

  const totalPages = Math.ceil(total / pageSize);
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const toggleSuspend = async (a: AlumniAccount) => {
    try {
      await apiFetch(`/api/alumni-accounts/${a.id}/suspend`, { method: "POST", json: { suspend: !a.suspendedAt } });
      qc.invalidateQueries({ queryKey: queryKeys.alumniAccounts.all });
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการดำเนินการ"); }
  };

  const openEmailEdit = (a: AlumniAccount) => {
    setEmailEdit(a);
    setEmailValue(a.email || "");
  };

  const saveEmail = async () => {
    if (!emailEdit) return;
    if (!emailValue.trim()) { setErrorMsg("กรุณากรอกอีเมล"); return; }
    setEmailSaving(true);
    setErrorMsg("");
    try {
      await apiFetch(`/api/alumni-accounts/${emailEdit.id}`, { method: "PUT", json: { email: emailValue.trim() } });
      setEmailEdit(null);
      qc.invalidateQueries({ queryKey: queryKeys.alumniAccounts.all });
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาด"); } finally { setEmailSaving(false); }
  };

  // --- Admin-approval actions (review modal) ---
  const refreshAfterReview = () => {
    qc.invalidateQueries({ queryKey: queryKeys.alumniAccounts.all });
  };

  const handleApprove = async () => {
    if (!reviewAccount) return;
    setReviewActioning(true); setErrorMsg("");
    try {
      await apiFetch(`/api/alumni-accounts/${reviewAccount.id}/approve`, { method: "POST" });
      setReviewAccount(null);
      refreshAfterReview();
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการอนุมัติ"); }
    finally { setReviewActioning(false); }
  };

  const handleReject = async () => {
    if (!reviewAccount) return;
    setReviewActioning(true); setErrorMsg("");
    try {
      await apiFetch(`/api/alumni-accounts/${reviewAccount.id}/reject`, { method: "POST", json: {} });
      setReviewAccount(null);
      refreshAfterReview();
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการปฏิเสธ"); }
    finally { setReviewActioning(false); }
  };

  const handleReverify = async () => {
    if (!reviewAccount) return;
    setReviewActioning(true); setErrorMsg("");
    try {
      const res = await apiFetch<{ verification: SignupVerification }>(
        `/api/alumni-accounts/${reviewAccount.id}/reverify`,
        { method: "POST" },
      );
      setReviewAccount({ ...reviewAccount, signupVerification: res.verification });
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "ไม่สามารถตรวจสอบใหม่ได้"); }
    finally { setReviewActioning(false); }
  };

  return (
    <>
      {errorMsg && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-4 font-bold text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
          <span>มีคำขอลงทะเบียนรอการอนุมัติ <strong>{pendingCount}</strong> รายการ</span>
          {statusFilter !== "PENDING" && (
            <button onClick={() => { setStatusFilter("PENDING"); setPage(1); }} className="ml-auto rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 cursor-pointer">
              ดูรายการรออนุมัติ
            </button>
          )}
        </div>
      )}

      {/* Search + status filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          placeholder="ค้นหาชื่อ, รหัสนักศึกษา, อีเมล..."
          formClassName="w-full max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
        >
          <option value="all">ทุกสถานะ</option>
          <option value="PENDING">รออนุมัติ</option>
          <option value="ACTIVE">ใช้งาน</option>
          <option value="REJECTED">ปฏิเสธ</option>
        </select>
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
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">สถานะ</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">อีเมล</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">เบอร์โทรศัพท์</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">เข้าสู่ระบบล่าสุด</th>
                {canWrite && <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap">การจัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 10 : 9} className="px-4 py-12 text-center"><div className="flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div></td></tr>
              ) : alumni.length === 0 ? (
                <tr><td colSpan={canWrite ? 10 : 9} className="px-4 py-12 text-center text-[var(--muted)]">ไม่พบข้อมูล</td></tr>
              ) : (
                alumni.map((a, i) => (
                  <tr
                    key={a.id}
                    // Pending/rejected accounts aren't confirmed alumni — route them to the
                    // review modal (same as the eye icon) instead of a sparse profile page.
                    onClick={() =>
                      a.accountStatus === "ACTIVE"
                        ? router.push(`/management/alumni/${a.id}`)
                        : setReviewAccount(a)
                    }
                    className="cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-center text-gray-500">{(page - 1) * pageSize + i + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.studentId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.prefix}{a.firstName} {a.newLastName || a.lastName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.cohort || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{DEGREE_LABELS[a.degreeLevel] || a.degreeLevel}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[a.accountStatus]}`}>
                        {STATUS_LABELS[a.accountStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.email || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{joinPhones(a.phones) || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(a.lastLoginAt)}</td>
                    {canWrite && (
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setReviewAccount(a)} className="rounded p-1.5 text-blue-600 hover:bg-blue-100 cursor-pointer" title="ตรวจสอบการลงทะเบียน">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                          </button>
                          <button onClick={() => openEmailEdit(a)} className="rounded p-1.5 text-purple-600 hover:bg-purple-100 cursor-pointer" title="เปลี่ยนอีเมล">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                          </button>
                          {a.accountStatus === "ACTIVE" && (
                            <button onClick={() => toggleSuspend(a)} className={`rounded p-1.5 hover:bg-gray-100 cursor-pointer ${a.suspendedAt ? "text-green-600" : "text-amber-600"}`} title={a.suspendedAt ? "ยกเลิกการระงับ" : "ระงับบัญชี"}>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            </button>
                          )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50">ก่อนหน้า</button>
          <span className="text-sm text-[var(--muted)]">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50">ถัดไป</button>
        </div>
      )}

      {/* Change email modal */}
      {emailEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              เปลี่ยนอีเมล — {emailEdit.firstName} {emailEdit.newLastName || emailEdit.lastName}
            </h3>
            <label className="mb-1 block text-sm font-medium text-gray-700">อีเมลใหม่</label>
            <input
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setEmailEdit(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={saveEmail} disabled={emailSaving} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                {emailSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signup review / approval modal */}
      {reviewAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">ตรวจสอบการลงทะเบียน</h3>
              <p className="text-sm text-gray-600">
                {reviewAccount.prefix}{reviewAccount.firstName} {reviewAccount.lastName} · รหัสนักศึกษา {reviewAccount.studentId}
              </p>
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[reviewAccount.accountStatus]}`}>
                {STATUS_LABELS[reviewAccount.accountStatus]}
              </span>
            </div>

            {errorMsg && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{errorMsg}</div>
            )}

            {reviewAccount.signupVerification ? (
              <VerificationFields v={reviewAccount.signupVerification} />
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                ไม่มีข้อมูลการตรวจสอบสำหรับบัญชีนี้
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={handleReverify} disabled={reviewActioning} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
                ตรวจสอบใหม่
              </button>
              {reviewAccount.accountStatus !== "REJECTED" && (
                <button onClick={handleReject} disabled={reviewActioning} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer">
                  ปฏิเสธ
                </button>
              )}
              {reviewAccount.accountStatus !== "ACTIVE" && (
                <button onClick={handleApprove} disabled={reviewActioning} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 cursor-pointer">
                  อนุมัติ
                </button>
              )}
              <button onClick={() => setReviewAccount(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ───── Signup verification review components ───── */
function VerdictIcon({ match }: { match: boolean | null }) {
  if (match === null) return <span className="text-gray-400">—</span>;
  if (match) return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">✓</span>;
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">✗</span>;
}

function SummaryBanner({ color, text }: { color: "green" | "red" | "amber"; text: string }) {
  const cls =
    color === "green"
      ? "border-green-200 bg-green-50 text-green-700"
      : color === "red"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return <div className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${cls}`}>{text}</div>;
}

const VERIFICATION_FIELDS: {
  key: keyof SignupVerification["fields"];
  label: string;
  fmt: (x: string | null) => string | null;
}[] = [
  { key: "studentId", label: "รหัสนักศึกษา", fmt: (x) => x },
  { key: "firstName", label: "ชื่อ", fmt: (x) => x },
  { key: "lastName", label: "นามสกุล", fmt: (x) => x },
  { key: "birthDate", label: "วันเกิด", fmt: (x) => (x ? formatBirthDateThaiSlash(x) ?? x : null) },
  { key: "cohort", label: "ปีที่จบ / รุ่น", fmt: (x) => x },
  { key: "degreeLevel", label: "ระดับการศึกษา", fmt: (x) => (x ? DEGREE_LABELS[x] ?? x : null) },
];

/**
 * Renders what the applicant submitted, always ("ที่กรอก"). When an
 * authoritative source exists (CMU/local), also shows the comparison columns
 * + per-field verdict; when none was found (wrong studentId), only the
 * submitted values are shown so the admin can still see what was entered.
 */
function VerificationFields({ v }: { v: SignupVerification }) {
  // `source` is which authoritative record we compared against: "cmu" | "local" | null.
  const hasAuthoritative = v.source !== null;
  const sourceLabel = v.source === "cmu" ? "ระบบทะเบียน" : v.source === "local" ? "ข้อมูลในระบบ" : "";

  let summary: ReactNode;
  if (!hasAuthoritative && !v.cmuConsulted) {
    summary = <SummaryBanner color="amber" text="ไม่สามารถติดต่อระบบทะเบียนเพื่อตรวจสอบได้ในขณะลงทะเบียน — กด 'ตรวจสอบใหม่' เพื่อลองอีกครั้ง" />;
  } else if (!hasAuthoritative) {
    summary = <SummaryBanner color="red" text="ไม่พบรหัสนักศึกษานี้ในระบบทะเบียนและไม่มีข้อมูลในระบบ" />;
  } else {
    const mismatches = VERIFICATION_FIELDS.filter((f) => v.fields[f.key].match === false).length;
    summary =
      mismatches === 0
        ? <SummaryBanner color="green" text={`ข้อมูลตรงกับ${sourceLabel}ทั้งหมด`} />
        : <SummaryBanner color="red" text={`ข้อมูลไม่ตรงกับ${sourceLabel} ${mismatches} รายการ`} />;
  }

  return (
    <div>
      <div className="mb-4">{summary}</div>
      {v.source === "local" && (
        <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          ไม่พบรหัสนักศึกษานี้ในระบบทะเบียน CMU — เปรียบเทียบกับข้อมูลศิษย์เก่าที่บันทึกไว้ในระบบแทน
        </p>
      )}
      {/*
        The submitted values ("ที่กรอก") are ALWAYS rendered — even when no
        authoritative record was found (source === null, e.g. a wrong studentId
        that matches neither CMU nor a local alumni). In that case the
        comparison columns ("{sourceLabel}" / ผล) are simply hidden; the admin
        still sees exactly what the applicant entered. `v.fields[*].submitted`
        is populated by `buildSignupVerification` in every branch.
      */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 font-semibold">รายการ</th>
              <th className="px-3 py-2 font-semibold">ที่กรอก</th>
              {hasAuthoritative && <th className="px-3 py-2 font-semibold">{sourceLabel}</th>}
              {hasAuthoritative && <th className="px-3 py-2 text-center font-semibold">ผล</th>}
            </tr>
          </thead>
          <tbody>
            {VERIFICATION_FIELDS.map((f) => {
              const verdict = v.fields[f.key];
              return (
                <tr key={f.key} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{f.label}</td>
                  <td className="px-3 py-2 text-gray-900">{f.fmt(verdict.submitted) ?? "—"}</td>
                  {hasAuthoritative && <td className="px-3 py-2 text-gray-900">{f.fmt(verdict.authoritative) ?? "—"}</td>}
                  {hasAuthoritative && <td className="px-3 py-2 text-center"><VerdictIcon match={verdict.match} /></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-400">ตรวจสอบล่าสุดเมื่อ {new Date(v.comparedAt).toLocaleString("th-TH")}</p>
    </div>
  );
}

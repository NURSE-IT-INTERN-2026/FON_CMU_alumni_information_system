"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { DEGREE_LEVEL_OPTIONS, PREFIX_OPTIONS } from "@/lib/constants";

interface AlumniData {
  id: string;
  studentId: string;
  citizenId: string | null;
  birthDate: string | null;
  prefix: string;
  firstName: string;
  maidenLastName: string;
  newLastName: string | null;
  cohort: string | null;
  degreeLevel: string;
  province: string | null;
  email: string | null;
  phone: string | null;
  currentWorkplace: string | null;
  country: string | null;
}

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
};

export default function AlumniDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [alumni, setAlumni] = useState<AlumniData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
    prefix: "",
    firstName: "",
    maidenLastName: "",
    newLastName: "",
    cohort: "",
    degreeLevel: "",
    province: "",
    email: "",
    phone: "",
    currentWorkplace: "",
    country: "",
    citizenId: "",
    birthDate: "",
  });

  const fetchAlumni = useCallback(async () => {
    try {
      const res = await fetch(`/api/alumni-accounts/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAlumni(data);
      setForm({
        prefix: data.prefix || "",
        firstName: data.firstName || "",
        maidenLastName: data.maidenLastName || "",
        newLastName: data.newLastName || "",
        cohort: data.cohort || "",
        degreeLevel: data.degreeLevel || "",
        province: data.province || "",
        email: data.email || "",
        phone: data.phone || "",
        currentWorkplace: data.currentWorkplace || "",
        country: data.country || "",
        citizenId: data.citizenId || "",
        birthDate: data.birthDate || "",
      });
    } catch {
      setErrorMsg("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAlumni(); }, [fetchAlumni]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/alumni-accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }

      const updated = await res.json();
      setAlumni(updated);
      setEditMode(false);
      setSuccessMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!alumni) {
    return (
      <div className="py-20 text-center">
        <p className="text-[var(--danger)]">{errorMsg || "ไม่พบข้อมูลศิษย์เก่า"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={() => router.push("/settings/users")} className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            กลับไปยังรายการ
          </button>
          <h1 className="text-2xl font-bold text-[var(--primary)]">ข้อมูลศิษย์เก่า</h1>
        </div>
        {!editMode && (
          <button
            onClick={() => { setEditMode(true); setErrorMsg(""); setSuccessMsg(""); }}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
          >
            แก้ไข
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">{errorMsg}</div>
      )}
      {successMsg && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        {editMode ? (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Admin-only editable fields */}
            <div className="rounded-lg bg-amber-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-amber-800">ข้อมูลที่ผู้ดูแลเท่านั้นที่แก้ไขได้</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">เลขบัตรประชาชน (13 หลัก)</label>
                  <input type="text" value={form.citizenId} onChange={(e) => setForm((f) => ({ ...f, citizenId: e.target.value.replace(/\D/g, "").slice(0, 13) }))} className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">วันเกิด (ววปปปป พ.ศ.)</label>
                  <input type="text" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value.replace(/\D/g, "").slice(0, 8) }))} placeholder="01122504" className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
                </div>
              </div>
            </div>

            {/* Regular editable fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">รหัสนักศึกษา</label>
                <p className="rounded-lg border border-[var(--border)] bg-gray-50 px-4 py-2.5 text-sm text-[var(--muted)]">{alumni.studentId}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">คำนำหน้า</label>
                <select value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20">
                  <option value="">เลือกคำนำหน้า</option>
                  {PREFIX_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">ชื่อ</label>
                <input type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">นามสกุลเดิม</label>
                <input type="text" value={form.maidenLastName} onChange={(e) => setForm((f) => ({ ...f, maidenLastName: e.target.value }))} required className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">นามสกุลใหม่</label>
                <input type="text" value={form.newLastName} onChange={(e) => setForm((f) => ({ ...f, newLastName: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">รุ่นที่</label>
                <input type="text" value={form.cohort} onChange={(e) => setForm((f) => ({ ...f, cohort: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">ระดับปริญญา</label>
                <select value={form.degreeLevel} onChange={(e) => setForm((f) => ({ ...f, degreeLevel: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20">
                  <option value="">เลือกระดับปริญญา</option>
                  {DEGREE_LEVEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">จังหวัด</label>
                <input type="text" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">อีเมล</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">เบอร์โทรศัพท์</label>
                <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">สถานที่ทำงานปัจจุบัน</label>
                <input type="text" value={form.currentWorkplace} onChange={(e) => setForm((f) => ({ ...f, currentWorkplace: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">ประเทศ</label>
                <input type="text" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] disabled:opacity-60">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
              <button type="button" onClick={() => { setEditMode(false); setErrorMsg(""); }} className="rounded-lg border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50">ยกเลิก</button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ข้อมูลพื้นฐาน</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="รหัสนักศึกษา" value={alumni.studentId} />
                <InfoField label="เลขบัตรประชาชน" value={alumni.citizenId} />
                <InfoField label="วันเกิด (พ.ศ.)" value={alumni.birthDate} />
                <InfoField label="คำนำหน้า" value={alumni.prefix} />
                <InfoField label="ชื่อ" value={alumni.firstName} />
                <InfoField label="นามสกุลเดิม" value={alumni.maidenLastName} />
                <InfoField label="นามสกุลใหม่" value={alumni.newLastName} />
                <InfoField label="รุ่นที่" value={alumni.cohort} />
                <InfoField label="ระดับปริญญา" value={DEGREE_LABELS[alumni.degreeLevel] || alumni.degreeLevel} />
                <InfoField label="จังหวัด" value={alumni.province} />
              </div>
            </div>
            <div className="h-px bg-[var(--border)]" />
            <div>
              <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ข้อมูลติดต่อ</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoField label="อีเมล" value={alumni.email} />
                <InfoField label="เบอร์โทรศัพท์" value={alumni.phone} />
              </div>
            </div>
            <div className="h-px bg-[var(--border)]" />
            <div>
              <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ข้อมูลการทำงาน</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoField label="สถานที่ทำงานปัจจุบัน" value={alumni.currentWorkplace} />
                <InfoField label="ประเทศ" value={alumni.country} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--foreground)]">{value || "—"}</p>
    </div>
  );
}

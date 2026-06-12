"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DEGREE_LEVEL_OPTIONS, PREFIX_OPTIONS, BASE_PATH } from "@/lib/constants";
import { profileFormSchema, type ProfileFormData } from "@/lib/validations";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";

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
  hasLoggedIn: boolean;
  adminEditedAt: string | null;
  lastLoginAt: string | null;
}

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
};

const AUTH_INPUT_CLASS = "px-4 py-2.5 text-[var(--foreground)] border-[var(--border)]";
const AUTH_LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[var(--foreground)]";

const defaultFormValues: ProfileFormData = {
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
};

export default function AlumniProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [alumni, setAlumni] = useState<AlumniData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modals
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);
  const [showAdminEditModal, setShowAdminEditModal] = useState(false);

  const {
    register,
    handleSubmit,
    reset: formReset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema) as any,
    defaultValues: defaultFormValues,
  });

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_PATH}/api/alumni-profile`);      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAlumni(data);
      formReset({
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
      });

      // Check first-login modal
      const firstParam = searchParams.get("first");
      const dismissedFirst = localStorage.getItem(`alumni-first-login-dismissed-${data.id}`);
      if ((firstParam === "1" || !dismissedFirst) && data.hasLoggedIn) {
        if (!dismissedFirst) {
          setShowFirstLoginModal(true);
        }
      }

      // Check admin-edit notification
      if (data.adminEditedAt) {
        const lastSeen = localStorage.getItem(`alumni-admin-edit-seen-${data.id}`);
        if (!lastSeen || new Date(data.adminEditedAt) > new Date(lastSeen)) {
          setShowAdminEditModal(true);
        }
      }
    } catch {
      setErrorMsg("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [searchParams, formReset]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  function dismissFirstLoginModal() {
    if (alumni) {
      localStorage.setItem(`alumni-first-login-dismissed-${alumni.id}`, "true");
    }
    setShowFirstLoginModal(false);
  }

  function dismissAdminEditModal() {
    if (alumni?.adminEditedAt) {
      localStorage.setItem(`alumni-admin-edit-seen-${alumni.id}`, alumni.adminEditedAt);
    }
    setShowAdminEditModal(false);
  }

  async function handleSave(data: ProfileFormData) {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch(`${BASE_PATH}/api/alumni-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        setErrorMsg(errData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        return;
      }

      const updated = await res.json();
      setAlumni(updated);
      setEditMode(false);
      setSuccessMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch {
      setErrorMsg("ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditMode(false);
    setErrorMsg("");
    // Reset form back to alumni data
    if (alumni) {
      formReset({
        prefix: alumni.prefix || "",
        firstName: alumni.firstName || "",
        maidenLastName: alumni.maidenLastName || "",
        newLastName: alumni.newLastName || "",
        cohort: alumni.cohort || "",
        degreeLevel: alumni.degreeLevel || "",
        province: alumni.province || "",
        email: alumni.email || "",
        phone: alumni.phone || "",
        currentWorkplace: alumni.currentWorkplace || "",
        country: alumni.country || "",
      });
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
    <>
      {/* First-login modal */}
      {showFirstLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <svg className="h-6 w-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-[var(--foreground)]">พบข้อมูลของท่านในระบบแล้ว</h3>
            <p className="mb-6 text-sm text-[var(--muted)]">
              พบข้อมูลของท่านในระบบแล้ว กรุณาตรวจสอบและแก้ไขข้อมูลตามต้องการ
            </p>
            <button
              onClick={dismissFirstLoginModal}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* Admin-edit notification modal */}
      {showAdminEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-[var(--foreground)]">ผู้ดูแลระบบได้แก้ไขข้อมูลของท่าน</h3>
            <p className="mb-6 text-sm text-[var(--muted)]">
              ผู้ดูแลระบบได้แก้ไขข้อมูลของท่าน กรุณาตรวจสอบความถูกต้อง หากไม่ถูกต้องกรุณาติดต่อผู้ดูแลระบบ
            </p>
            <button
              onClick={dismissAdminEditModal}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">ข้อมูลส่วนตัว</h1>
            <p className="text-sm text-[var(--muted)]">ดูและแก้ไขข้อมูลส่วนตัวของท่าน</p>
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

        {/* Messages */}
        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMsg}
          </div>
        )}

        {/* Profile card */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          {editMode ? (
            <form onSubmit={handleSubmit(handleSave)} className="space-y-5">
              {/* Read-only fields */}
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ข้อมูลที่ไม่สามารถแก้ไขได้</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">รหัสนักศึกษา</label>
                    <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)]">{alumni.studentId}</p>
                  </div>
                  {alumni.citizenId && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">เลขบัตรประชาชน</label>
                      <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)]">{alumni.citizenId}</p>
                    </div>
                  )}
                  {alumni.birthDate && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">วันเกิด (พ.ศ.)</label>
                      <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)]">{alumni.birthDate}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="คำนำหน้า" required error={errors.prefix?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormSelect
                    registration={register("prefix")}
                    error={errors.prefix?.message}
                    className={AUTH_INPUT_CLASS}
                  >
                    <option value="">เลือกคำนำหน้า</option>
                    {PREFIX_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </FormSelect>
                </FormField>

                <FormField label="ชื่อ" required error={errors.firstName?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("firstName")}
                    error={errors.firstName?.message}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="นามสกุลเดิม" required error={errors.maidenLastName?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("maidenLastName")}
                    error={errors.maidenLastName?.message}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="นามสกุลใหม่ (หลังแต่งงาน)" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("newLastName")}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="รุ่นที่" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("cohort")}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="ระดับปริญญา" required error={errors.degreeLevel?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormSelect
                    registration={register("degreeLevel")}
                    error={errors.degreeLevel?.message}
                    className={AUTH_INPUT_CLASS}
                  >
                    <option value="">เลือกระดับปริญญา</option>
                    {DEGREE_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </FormSelect>
                </FormField>

                <FormField label="จังหวัด" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("province")}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="อีเมล" error={errors.email?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("email")}
                    error={errors.email?.message}
                    type="email"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="เบอร์โทรศัพท์" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("phone")}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="สถานที่ทำงานปัจจุบัน" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("currentWorkplace")}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="ประเทศ" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("country")}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] disabled:opacity-60"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          ) : (
            /* View mode */
            <div className="space-y-6">
              {/* Read-only identity section */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ข้อมูลพื้นฐาน</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="รหัสนักศึกษา" value={alumni.studentId} />
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

              {/* Contact section */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ข้อมูลติดต่อ</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="อีเมล" value={alumni.email} />
                  <InfoField label="เบอร์โทรศัพท์" value={alumni.phone} />
                </div>
              </div>

              <div className="h-px bg-[var(--border)]" />

              {/* Work section */}
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
    </>
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

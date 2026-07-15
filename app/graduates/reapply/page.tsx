"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { BASE_PATH, DEGREE_LEVEL_OPTIONS } from "@/lib/constants";
import { alumniReapplySchema, type AlumniReapplyData } from "@/lib/validations";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import PasswordInput from "@/components/form/PasswordInput";
import FormSelect from "@/components/form/FormSelect";
import BirthDateSelect from "@/components/form/BirthDateSelect";

type PreparedFields = {
  studentId: string;
  degreeLevel: string;
  cohort: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
};

export default function AlumniReapplyPage() {
  return (
    <Suspense>
      <AlumniReapplyForm />
    </Suspense>
  );
}

function AlumniReapplyForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"credentials" | "form" | "done">("credentials");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [credError, setCredError] = useState("");
  const [credLoading, setCredLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  const {
    register,
    control,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<AlumniReapplyData>({
    resolver: zodResolver(alumniReapplySchema),
    defaultValues: {
      studentId: "",
      degreeLevel: "",
      cohort: "",
      firstName: "",
      lastName: "",
      birthDate: "",
    },
  });

  // Step 1: prove identity → fetch the account's current data to pre-fill.
  async function onPrepare(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setCredError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    setCredError("");
    setCredLoading(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/alumni-auth/reapply/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = (await res.json()) as PreparedFields & { error?: string };
      if (!res.ok) {
        setCredError(data.error || "ไม่สามารถยื่นคำขอใหม่ได้");
        return;
      }
      reset({
        studentId: data.studentId,
        degreeLevel: data.degreeLevel,
        cohort: data.cohort,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate,
      });
      setStep("form");
    } catch {
      setCredError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setCredLoading(false);
    }
  }

  // Step 2: submit the corrected application → back to the admin queue (PENDING).
  async function onSubmit(data: AlumniReapplyData) {
    setSubmitError("");
    setSubmitLoading(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/alumni-auth/reapply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          studentId: data.studentId.trim(),
          degreeLevel: data.degreeLevel,
          cohort: data.cohort.trim(),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          birthDate: data.birthDate,
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setSubmitError(resData.error || "ไม่สามารถยื่นคำขอใหม่ได้");
        return;
      }
      setStep("done");
    } catch {
      setSubmitError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <img src={`${BASE_PATH}/fon-cmu-logo.png`} alt="FON CMU" className="mx-auto mb-3 h-16 w-auto" />
          <h1 className="text-xl font-bold text-[var(--foreground)]">ยื่นคำขอใหม่</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มช.</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm sm:p-8">
          {step === "done" ? (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[var(--foreground)]">ยื่นคำขอใหม่สำเร็จ</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                คำขอของท่านถูกส่งกลับเข้าสู่ขั้นตอนการตรวจสอบโดยผู้ดูแลระบบแล้ว
                ท่านจะได้รับอีเมลแจ้งผลเมื่อมีการพิจารณา
              </p>
              <a
                href={`${BASE_PATH}/login`}
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
              >
                กลับสู่หน้าเข้าสู่ระบบ
              </a>
            </div>
          ) : step === "credentials" ? (
            <>
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Alumni Portal</p>
                <h2 className="mt-1 text-lg font-bold text-[var(--foreground)]">ยืนยันตัวตนเพื่อยื่นคำขอใหม่</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  กรอกอีเมลและรหัสผ่านของบัญชีที่ถูกปฏิเสธเพื่อเปิดแบบฟอร์มยื่นคำขอใหม่
                </p>
              </div>

              {credError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
                  {credError}
                </div>
              )}

              <form onSubmit={onPrepare} className="space-y-4">
                <FormField label="อีเมล" labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="example@email.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent text-[var(--foreground)] placeholder:text-[var(--muted)]"
                  />
                </FormField>
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                      รหัสผ่าน
                    </label>
                    <a
                      href={`${BASE_PATH}/graduates/forgot-password`}
                      className="mb-1.5 text-xs text-[var(--primary)] hover:underline"
                    >
                      ลืมรหัสผ่าน?
                    </a>
                  </div>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="กรอกรหัสผ่าน"
                    className="px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] border-[var(--border)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={credLoading}
                  className="flex w-full items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] disabled:opacity-60"
                >
                  {credLoading ? "กำลังตรวจสอบ..." : "ดำเนินการต่อ"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[var(--muted)]">
                <a href={`${BASE_PATH}/login`} className="text-[var(--primary)] hover:underline font-medium">
                  กลับสู่หน้าเข้าสู่ระบบ
                </a>
              </p>
            </>
          ) : (
            <>
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Alumni Portal</p>
                <h2 className="mt-1 text-lg font-bold text-[var(--foreground)]">แก้ไขข้อมูลและยื่นคำขอใหม่</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  ปรับปรุงข้อมูลให้ถูกต้องตามที่ท่านได้รับแจ้ง แล้วส่งคำขอเพื่อพิจารณาอีกครั้ง
                </p>
              </div>

              {submitError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="รหัสนักศึกษา" error={errors.studentId?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                    <FormInput
                      registration={register("studentId")}
                      error={errors.studentId?.message}
                      id="studentId"
                      type="text"
                      autoComplete="off"
                      placeholder="512045xxx"
                      className="px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] border-[var(--border)]"
                    />
                  </FormField>
                  <FormField label="ปีที่จบ (พ.ศ.)" error={errors.cohort?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                    <FormInput
                      registration={register("cohort")}
                      error={errors.cohort?.message}
                      id="cohort"
                      type="text"
                      autoComplete="off"
                      placeholder="2569"
                      className="px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] border-[var(--border)]"
                    />
                  </FormField>
                </div>

                <FormField label="ระดับการศึกษา" error={errors.degreeLevel?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  <FormSelect
                    registration={register("degreeLevel")}
                    error={errors.degreeLevel?.message}
                    className="w-full px-4 py-2.5 text-[var(--foreground)] border-[var(--border)]"
                  >
                    <option value="">เลือกระดับการศึกษา</option>
                    {DEGREE_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </FormSelect>
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="ชื่อ (ขณะศึกษา)" error={errors.firstName?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                    <FormInput
                      registration={register("firstName")}
                      error={errors.firstName?.message}
                      id="firstName"
                      type="text"
                      autoComplete="off"
                      placeholder="สมหญิง"
                      className="px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] border-[var(--border)]"
                    />
                  </FormField>
                  <FormField label="สกุล (ขณะศึกษา)" error={errors.lastName?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                    <FormInput
                      registration={register("lastName")}
                      error={errors.lastName?.message}
                      id="lastName"
                      type="text"
                      autoComplete="off"
                      placeholder="รักเรียน"
                      className="px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] border-[var(--border)]"
                    />
                  </FormField>
                </div>

                <FormField label="วันเกิด (ววปปปป พ.ศ.)" error={errors.birthDate?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  <BirthDateSelect control={control} name="birthDate" error={errors.birthDate?.message} />
                </FormField>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("credentials")}
                    className="rounded-lg border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-gray-50"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="flex flex-1 items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] disabled:opacity-60"
                  >
                    {submitLoading ? "กำลังส่งคำขอ..." : "ส่งคำขอใหม่"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

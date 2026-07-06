"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BASE_PATH, DEGREE_LEVEL_OPTIONS } from "@/lib/constants";
import { alumniSignupSchema, type AlumniSignupData } from "@/lib/validations";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";
import BirthDateSelect from "@/components/form/BirthDateSelect";

export default function AlumniSignupPage() {
  return (
    <Suspense>
      <AlumniSignupForm />
    </Suspense>
  );
}

function AlumniSignupForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AlumniSignupData>({
    resolver: zodResolver(alumniSignupSchema),
    defaultValues: {
      studentId: "",
      degreeLevel: "",
      cohort: "",
      firstName: "",
      lastName: "",
      birthDate: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: AlumniSignupData) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${BASE_PATH}/api/alumni-auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: data.studentId.trim(),
          degreeLevel: data.degreeLevel,
          cohort: data.cohort.trim(),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          birthDate: data.birthDate,
          email: data.email.trim().toLowerCase(),
          password: data.password,
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        setError(resData.error || "เกิดข้อผิดพลาดในการลงทะเบียน");
        return;
      }

      // Signup creates an UNVERIFIED account — the applicant must confirm
      // email ownership (click the verification link) before the account enters
      // the admin-approval queue. Show a "check your email" panel with a resend
      // option instead of redirecting (no session is created).
      setSubmittedEmail(data.email.trim().toLowerCase());
      setSubmitted(true);
    } catch {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!submittedEmail || resendState === "sending") return;
    setResendState("sending");
    try {
      await fetch(`${BASE_PATH}/api/alumni-auth/verify-email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail }),
      });
    } catch {
      // Swallow — the endpoint is enumeration-safe and returns the same message
      // regardless; we just reflect a generic "sent" state to the user.
    }
    setResendState("sent");
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between bg-[var(--primary-dark)] overflow-hidden p-12">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <div className="pointer-events-none absolute top-1/2 right-12 h-48 w-48 rounded-full bg-[var(--accent)]/10" />

        <div className="relative z-10 flex items-center gap-3">
          <img src={`${BASE_PATH}/fon-cmu-logo.png`} alt="FON CMU" className="h-10 w-auto" />
          <span className="text-sm font-semibold text-white/80">FON CMU · Alumni</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight text-white">
            ลงทะเบียน
            <br />
            <span className="text-[var(--accent)]">ศิษย์เก่า คณะพยาบาลศาสตร์ มช.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
            กรอกข้อมูลเพื่อยืนยันตัวตนและสร้างบัญชีสำหรับเข้าสู่ระบบ
          </p>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
        </div>
      </div>

      {/* Right panel — Signup form */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          {submitted ? (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100">
                <svg className="h-8 w-8 text-sky-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">กรุณายืนยันอีเมล</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                ระบบได้ส่งลิงก์ยืนยันอีเมลไปยัง<strong className="text-[var(--foreground)]"> {submittedEmail} </strong>แล้ว
                กรุณาตรวจสอบกล่องอีเมลของท่านและคลิกลิงก์เพื่อยืนยันตัวตน
                หลังยืนยันแล้ว บัญชีของท่านจะเข้าสู่ขั้นตอนการตรวจสอบโดยผู้ดูแลระบบ
              </p>
              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState !== "idle"}
                  className="text-sm font-medium text-[var(--primary)] hover:underline disabled:opacity-60 disabled:no-underline cursor-pointer"
                >
                  {resendState === "sending"
                    ? "กำลังส่ง..."
                    : resendState === "sent"
                      ? "ส่งลิงก์ยืนยันอีกครั้งแล้ว กรุณาตรวจสอบอีเมล"
                      : "ไม่ได้รับอีเมล? ส่งลิงก์ยืนยันอีกครั้ง"}
                </button>
                <a
                  href={`${BASE_PATH}/login`}
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
                >
                  กลับสู่หน้าเข้าสู่ระบบ
                </a>
              </div>
            </div>
          ) : (
          <>
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <img src={`${BASE_PATH}/fon-cmu-logo.png`} alt="FON CMU" className="mx-auto mb-3 h-16 w-auto" />
            <h1 className="text-lg font-bold text-[var(--foreground)]">ระบบสารสนเทศศิษย์เก่า</h1>
            <p className="text-sm text-[var(--muted)]">คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่</p>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Alumni Portal</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)]">ลงทะเบียนสำหรับศิษย์เก่า</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">กรอกข้อมูลที่ตรงกับระเบียนนักศึกษาของท่าน</p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Identity verification fields */}
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

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--muted)]">ข้อมูลบัญชี</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            {/* Account fields */}
            <FormField label="อีเมล" error={errors.email?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              <FormInput
                registration={register("email")}
                error={errors.email?.message}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="example@email.com"
                className="px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] border-[var(--border)]"
              />
            </FormField>

            <FormField label="รหัสผ่าน" error={errors.password?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              <FormInput
                registration={register("password")}
                error={errors.password?.message}
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="อย่างน้อย 8 ตัวอักษร"
                className="px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] border-[var(--border)]"
              />
            </FormField>

            <FormField label="ยืนยันรหัสผ่าน" error={errors.confirmPassword?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              <FormInput
                registration={register("confirmPassword")}
                error={errors.confirmPassword?.message}
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                className="px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] border-[var(--border)]"
              />
            </FormField>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
              {!loading && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            มีบัญชีอยู่แล้ว?{" "}
            <a href={`${BASE_PATH}/login`} className="text-[var(--primary)] hover:underline font-medium">
              เข้าสู่ระบบ
            </a>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

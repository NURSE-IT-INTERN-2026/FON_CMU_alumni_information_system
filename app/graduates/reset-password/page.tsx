"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { BASE_PATH } from "@/lib/constants";
import { resetPasswordSchema, type ResetPasswordData } from "@/lib/validations";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token || "",
      password: "",
      confirmPassword: "",
    },
  });

  // If no token, show error
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">ลิงก์ไม่ถูกต้อง</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง กรุณาขอลิงก์ใหม่
          </p>
          <a
            href={`${BASE_PATH}/graduates/forgot-password`}
            className="mt-6 inline-block text-sm font-medium text-[var(--primary)] hover:underline"
          >
            ขอลิงก์รีเซ็ตรหัสผ่านใหม่
          </a>
        </div>
      </div>
    );
  }

  async function onSubmit(data: ResetPasswordData) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${BASE_PATH}/api/alumni-auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.token,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        setError(resData.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }

      router.push("/login?reset=success");
    } catch {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
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
            ตั้งรหัสผ่านใหม่
            <br />
            <span className="text-[var(--accent)]">คณะพยาบาลศาสตร์ มช.</span>
          </h1>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
        </div>
      </div>

      {/* Right panel — Form */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <img src={`${BASE_PATH}/fon-cmu-logo.png`} alt="FON CMU" className="mx-auto mb-3 h-16 w-auto" />
            <h1 className="text-lg font-bold text-[var(--foreground)]">ระบบสารสนเทศศิษย์เก่า</h1>
            <p className="text-sm text-[var(--muted)]">คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่</p>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Alumni Portal</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)]">ตั้งรหัสผ่านใหม่</h2>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="รหัสผ่านใหม่" error={errors.password?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
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

            <FormField label="ยืนยันรหัสผ่านใหม่" error={errors.confirmPassword?.message} labelClassName="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
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
              {loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
              {!loading && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            <a href={`${BASE_PATH}/login`} className="text-[var(--primary)] hover:underline font-medium">
              ← กลับไปเข้าสู่ระบบ
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BASE_PATH } from "@/lib/constants";
import { adminLoginSchema, alumniLoginSchema, type AdminLoginData, type AlumniLoginData } from "@/lib/validations";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";

const ALUMNI_ERROR_KEYS = new Set(["alumni_not_found", "alumni_rejected"]);

const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: "การเข้าสู่ระบบด้วยบัญชี CMU ถูกปฏิเสธ",
  oauth_invalid_state: "เกิดข้อผิดพลาดด้านความปิดกั้น กรุณาลองใหม่",
  oauth_expired: "การขออนุญาตหมดอายุ กรุณาลองใหม่",
  oauth_token_failed: "ไม่สามารถรับโทเคนจาก CMU ได้ กรุณาลองใหม่",
  oauth_profile_failed: "ไม่สามารถดึงข้อมูลจาก CMU ได้ กรุณาลองใหม่",
  oauth_user_not_found: "บัญชี CMU นี้ยังไม่ได้ลงทะเบียนในระบบ",
  alumni_not_found: "ไม่พบข้อมูลของท่านในระบบ กรุณาติดต่อผู้ดูแลระบบ",
  alumni_rejected: "บัญชีของท่านถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ",
  oauth_error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย CMU กรุณาลองใหม่",
};

type LoginMode = "admin" | "alumni";

const AUTH_INPUT_CLASS = "px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] border-[var(--border)]";
const AUTH_LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[var(--foreground)]";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const resetSuccess = searchParams.get("reset") === "success";
  const signupSuccess = searchParams.get("signup") === "success";

  // Auto-switch to alumni tab if the error/params are alumni-specific
  const isAlumniError = oauthError ? ALUMNI_ERROR_KEYS.has(oauthError) : false;
  const [mode, setMode] = useState<LoginMode>(
    isAlumniError || resetSuccess || signupSuccess ? "alumni" : "admin"
  );

  const [error, setError] = useState(
    oauthError
      ? OAUTH_ERRORS[oauthError] || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"
      : ""
  );
  const [success, setSuccess] = useState(
    resetSuccess
      ? "รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"
      : signupSuccess
        ? "ลงทะเบียนสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติบัญชีของท่าน จึงจะสามารถเข้าสู่ระบบได้"
        : ""
  );
  const [loading, setLoading] = useState(false);

  // Admin form
  const adminForm = useForm<AdminLoginData>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Alumni form
  const alumniForm = useForm<AlumniLoginData>({
    resolver: zodResolver(alumniLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Clear success message after 10 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 10000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  async function handleAdminSubmit(data: AdminLoginData) {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(`${BASE_PATH}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resData = await res.json();

      if (!res.ok) {
        setError(resData.error || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        return;
      }

      router.push("/management/dashboard");
    } catch {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  async function handleAlumniSubmit(data: AlumniLoginData) {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(`${BASE_PATH}/api/alumni-auth/login-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email.trim().toLowerCase(), password: data.password }),
      });

      const resData = await res.json();

      if (!res.ok) {
        setError(resData.error || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        return;
      }

      if (resData.pendingApproval) {
        router.push(resData.redirect || "/graduates/pending");
        return;
      }

      router.push("/graduates/profile");
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
            เชื่อมโยงศิษย์เก่า
            <br />
            <span className="text-[var(--accent)]">คณะพยาบาลศาสตร์ มช.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
            ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
            — ศูนย์กลางเชื่อมโยงเคือข่ายศิษย์เก่าสู่การพัฒนาวิชาชีพการพยาบาลอย่างยั่งยืน
          </p>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
        </div>
      </div>

      {/* Right panel — Login forms */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <img src={`${BASE_PATH}/fon-cmu-logo.png`} alt="FON CMU" className="mx-auto mb-3 h-16 w-auto" />
            <h1 className="text-lg font-bold text-[var(--foreground)]">ระบบสารสนเทศศิษย์เก่า</h1>
            <p className="text-sm text-[var(--muted)]">คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่</p>
          </div>

          {/* Header */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Alumni Portal</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)]">เข้าสู่ระบบ</h2>
          </div>

          {/* Mode toggle tabs */}
          <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => { setMode("admin"); setError(""); }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === "admin"
                  ? "bg-white text-[var(--primary)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              ผู้ดูแลระบบ / ผู้บริหาร
            </button>
            <button
              onClick={() => { setMode("alumni"); setError(""); }}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === "alumni"
                  ? "bg-white text-[var(--primary)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              ศิษย์เก่า
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-[var(--success)]">
              {success}
            </div>
          )}

          {/* ============ ADMIN MODE ============ */}
          {mode === "admin" && (
            <>
              {/* CMU OAuth */}
              <a
                href={`${BASE_PATH}/api/auth/cmu-login`}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-[var(--foreground)] transition-all hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-900/30"
              >
                <img src={`${BASE_PATH}/CMU_logo.png`} alt="CMU" className="h-6 w-6 rounded-sm" />
                <span className="bg-gradient-to-r from-purple-900 to-purple-700 bg-clip-text text-transparent font-semibold">
                  เข้าสู่ระบบด้วยบัญชี CMU IT Account
                </span>
              </a>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-xs text-[var(--muted)]">หรือ</span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>

              {/* Email / Password form */}
              <form onSubmit={adminForm.handleSubmit(handleAdminSubmit)} className="space-y-4">
                <FormField label="อีเมล" error={adminForm.formState.errors.email?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={adminForm.register("email")}
                    error={adminForm.formState.errors.email?.message}
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    placeholder="example@cmu.ac.th"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>
                <FormField label="รหัสผ่าน" error={adminForm.formState.errors.password?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={adminForm.register("password")}
                    error={adminForm.formState.errors.password?.message}
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                  {!loading && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ============ ALUMNI MODE ============ */}
          {mode === "alumni" && (
            <>
              {/* Email + Password form */}
              <form onSubmit={alumniForm.handleSubmit(handleAlumniSubmit)} className="space-y-4">
                <FormField label="อีเมล" error={alumniForm.formState.errors.email?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={alumniForm.register("email")}
                    error={alumniForm.formState.errors.email?.message}
                    id="alumni-email"
                    type="email"
                    autoComplete="email"
                    placeholder="example@email.com"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="alumni-password" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                      รหัสผ่าน
                    </label>
                    <a
                      href={`${BASE_PATH}/graduates/forgot-password`}
                      className="mb-1.5 text-xs text-[var(--primary)] hover:underline"
                    >
                      ลืมรหัสผ่าน?
                    </a>
                  </div>
                  <FormInput
                    registration={alumniForm.register("password")}
                    error={alumniForm.formState.errors.password?.message}
                    id="alumni-password"
                    type="password"
                    autoComplete="current-password"
                    className={AUTH_INPUT_CLASS}
                  />
                  {alumniForm.formState.errors.password && (
                    <p className="mt-1 text-xs text-red-500">{alumniForm.formState.errors.password.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                  {!loading && (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  )}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-[var(--muted)]">
                ยังไม่มีบัญชี?{" "}
                <a href={`${BASE_PATH}/graduates/signup`} className="text-[var(--primary)] hover:underline font-medium">
                  ลงทะเบียน
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

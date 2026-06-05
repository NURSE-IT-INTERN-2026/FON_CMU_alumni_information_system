"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const ALUMNI_OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: "การเข้าสู่ระบบด้วยบัญชี CMU ถูกปฏิเสธ",
  oauth_invalid_state: "เกิดข้อผิดพลาดด้านความปิดกั้น กรุณาลองใหม่",
  oauth_expired: "การขออนุญาตหมดอายุ กรุณาลองใหม่",
  oauth_token_failed: "ไม่สามารถรับโทเคนจาก CMU ได้ กรุณาลองใหม่",
  oauth_profile_failed: "ไม่สามารถดึงข้อมูลจาก CMU ได้ กรุณาลองใหม่",
  alumni_not_found: "ไม่พบข้อมูลของท่านในระบบ กรุณาติดต่อผู้ดูแลระบบ",
  not_nursing_faculty: "บัญชีของท่านไม่ได้สังกัดคณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่ กรุณาติดต่อผู้ดูแลระบบ",
  oauth_error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย CMU กรุณาลองใหม่",
  invalid_credentials: "เลขบัตรประชาชนหรือวันเกิดไม่ถูกต้อง",
};

export default function AlumniLoginPage() {
  return (
    <Suspense>
      <AlumniLoginForm />
    </Suspense>
  );
}

function AlumniLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const [citizenId, setCitizenId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState(
    oauthError
      ? ALUMNI_OAUTH_ERRORS[oauthError] || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"
      : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/alumni-auth/login-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citizenId, birthDate }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        return;
      }

      router.push("/alumni/profile");
    } catch {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  function formatBirthDate(value: string): string {
    // Only allow digits, max 8
    return value.replace(/\D/g, "").slice(0, 8);
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between bg-[var(--primary-dark)] overflow-hidden p-12">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <div className="pointer-events-none absolute top-1/2 right-12 h-48 w-48 rounded-full bg-[var(--accent)]/10" />

        <div className="relative z-10 flex items-center gap-3">
          <img src="/fon-cmu-logo.png" alt="FON CMU" className="h-10 w-auto" />
          <span className="text-sm font-semibold text-white/80">FON CMU · Alumni</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight text-white">
            สำหรับศิษย์เก่า
            <br />
            <span className="text-[var(--accent)]">คณะพยาบาลศาสตร์ มช.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
            เข้าสู่ระบบเพื่อดูและแก้ไขข้อมูลส่วนตัวของท่าน
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
            <img src="/fon-cmu-logo.png" alt="FON CMU" className="mx-auto mb-3 h-16 w-auto" />
            <h1 className="text-lg font-bold text-[var(--foreground)]">ระบบสารสนเทศศิษย์เก่า</h1>
            <p className="text-sm text-[var(--muted)]">คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่</p>
          </div>

          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Alumni Portal</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)]">เข้าสู่ระบบสำหรับศิษย์เก่า</h2>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* CMU OAuth */}
          <a
            href="/api/alumni-auth/login"
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-[var(--foreground)] transition-all hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-900/30"
          >
            <img src="/CMU_logo.png" alt="CMU" className="h-6 w-6 rounded-sm" />
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

          {/* Citizen ID + Birthday form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="citizenId" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                เลขบัตรประชาชน (13 หลัก)
              </label>
              <input
                id="citizenId"
                type="text"
                inputMode="numeric"
                value={citizenId}
                onChange={(e) => setCitizenId(e.target.value.replace(/\D/g, "").slice(0, 13))}
                required
                autoComplete="off"
                placeholder="0000000000000"
                className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>

            <div>
              <label htmlFor="birthDate" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                วันเกิด (ววปปปป พ.ศ.)
              </label>
              <input
                id="birthDate"
                type="text"
                inputMode="numeric"
                value={birthDate}
                onChange={(e) => setBirthDate(formatBirthDate(e.target.value))}
                required
                autoComplete="off"
                placeholder="01122504"
                className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">รูปแบบ: วันที่(2หลัก) เดือน(2หลัก) ปี พ.ศ.(4หลัก) เช่น 01122504</p>
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

          {/* Admin login link */}
          <p className="mt-6 text-center text-xs text-[var(--muted)]">
            ผู้ดูแลระบบ?{" "}
            <a href="/login" className="text-[var(--primary)] hover:underline">
              เข้าสู่ระบบสำหรับผู้ดูแล
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: "การเข้าสู่ระบบด้วยบัญชี CMU ถูกปฏิเสธ",
  oauth_invalid_state: "เกิดข้อผิดพลาดด้านความปิดกั้น กรุณาลองใหม่",
  oauth_expired: "การขออนุญาตหมดอายุ กรุณาลองใหม่",
  oauth_token_failed: "ไม่สามารถรับโทเคนจาก CMU ได้ กรุณาลองใหม่",
  oauth_profile_failed: "ไม่สามารถดึงข้อมูลจาก CMU ได้ กรุณาลองใหม่",
  oauth_user_not_found: "บัญชี CMU นี้ยังไม่ได้ลงทะเบียนในระบบ",
  oauth_error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย CMU กรุณาลองใหม่",
};

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    oauthError
      ? OAUTH_ERRORS[oauthError] || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"
      : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        return;
      }

      router.push("/");
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
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <div className="pointer-events-none absolute top-1/2 right-12 h-48 w-48 rounded-full bg-[var(--accent)]/10" />

        {/* Top — Logo & name */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/fon-cmu-logo.png"
            alt="FON CMU"
            className="h-10 w-auto"
          />
          <span className="text-sm font-semibold text-white/80">
            FON CMU · Alumni
          </span>
        </div>

        {/* Middle — Tagline */}
        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight text-white">
            เชื่อมโยงศิษย์เก่า
            <br />
            <span className="text-[var(--accent)]">
              คณะพยาบาลศาสตร์ มช.
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
            ระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
            — ศูนย์กลางเชื่อมโยงเครือข่ายศิษย์เก่าสู่การพัฒนาวิชาชีพการพยาบาลอย่างยั่งยืน
          </p>
        </div>

        {/* Bottom — Footer */}
        <div className="relative z-10 text-xs text-white/40">
          © คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <img
              src="/fon-cmu-logo.png"
              alt="FON CMU"
              className="mx-auto mb-3 h-16 w-auto"
            />
            <h1 className="text-lg font-bold text-[var(--foreground)]">
              ระบบสารสนเทศศิษย์เก่า
            </h1>
            <p className="text-sm text-[var(--muted)]">
              คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
            </p>
          </div>

          {/* Header */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Alumni Portal
            </p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
              เข้าสู่ระบบ
            </h2>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* CMU OAuth */}
          <a
            href="/api/auth/cmu-login"
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

          {/* Email / Password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
              >
                อีเมล
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="example@cmu.ac.th"
                className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
              >
                รหัสผ่าน
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
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
        </div>
      </div>
    </div>
  );
}

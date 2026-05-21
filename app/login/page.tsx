"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    oauthError ? (OAUTH_ERRORS[oauthError] || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ") : ""
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
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg border border-[var(--border)] p-8">
            <h1 className="text-2xl font-bold text-center text-[var(--foreground)] mb-8">
              เข้าสู่ระบบ
            </h1>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
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
                  className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
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
                  className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-[var(--danger)]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-light)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-sm text-[var(--muted)]">หรือ</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <a
              href="/api/auth/cmu-login"
              className="mt-4 block w-full rounded-lg border-2 border-[var(--primary)] px-4 py-2.5 text-center text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/5"
            >
              เข้าสู่ระบบด้วยบัญชี CMU
            </a>

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-sm text-[var(--primary)] hover:text-[var(--primary-light)] transition-colors hover:underline"
              >
                กลับหน้าหลัก
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyIdentityPage() {
  return (
    <Suspense>
      <VerifyIdentityForm />
    </Suspense>
  );
}

function VerifyIdentityForm() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [cohort, setCohort] = useState("");
  const [firstName, setFirstName] = useState("");
  const [maidenLastName, setMaidenLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasOAuthEmail, setHasOAuthEmail] = useState(true);

  // Check if user came from OAuth flow by trying to read a cookie-indicator
  // The actual cookie check happens server-side in the API, but we show
  // a warning if the user navigated here directly
  useEffect(() => {
    // Try a quick fetch to check if the cookie exists
    fetch("/api/alumni-auth/verify-identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error && data.error.includes("OAuth")) {
          setHasOAuthEmail(false);
        }
      })
      .catch(() => {});
  }, []);

  function formatBirthDate(value: string): string {
    return value.replace(/\D/g, "").slice(0, 8);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!/^\d{8}$/.test(birthDate)) {
      setError("รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น DDMMYYYY");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/alumni-auth/verify-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId.trim(),
          cohort: cohort.trim(),
          firstName: firstName.trim(),
          maidenLastName: maidenLastName.trim(),
          birthDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }

      router.push(data.redirect || "/alumni/pending");
    } catch {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  if (!hasOAuthEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">ไม่สามารถเข้าถึงหน้านี้ได้</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            กรุณาเข้าสู่ระบบด้วย CMU IT Account ก่อน
          </p>
          <a
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-[var(--primary)] hover:underline"
          >
            ← กลับไปเข้าสู่ระบบ
          </a>
        </div>
      </div>
    );
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
            ยืนยันตัวตน
            <br />
            <span className="text-[var(--accent)]">ศิษย์เก่า คณะพยาบาลศาสตร์ มช.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
            กรอกข้อมูลที่ตรงกับระเบียนนักศึกษาของท่านเพื่อยืนยันว่าท่านเป็นศิษย์เก่า
          </p>
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
            <img src="/fon-cmu-logo.png" alt="FON CMU" className="mx-auto mb-3 h-16 w-auto" />
            <h1 className="text-lg font-bold text-[var(--foreground)]">ระบบสารสนเทศศิษย์เก่า</h1>
            <p className="text-sm text-[var(--muted)]">คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่</p>
          </div>

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Alumni Portal</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--foreground)]">ยืนยันตัวตน</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">กรอกข้อมูลที่ตรงกับระเบียนนักศึกษาของท่าน</p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="studentId" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  รหัสนักศึกษา
                </label>
                <input
                  id="studentId"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="512045xxx"
                  className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <div>
                <label htmlFor="cohort" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  ปีที่จบ / รุ่น
                </label>
                <input
                  id="cohort"
                  type="text"
                  value={cohort}
                  onChange={(e) => setCohort(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="1"
                  className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  ชื่อ (ขณะศึกษา)
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="สมหญิง"
                  className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <div>
                <label htmlFor="maidenLastName" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                  สกุล (ขณะศึกษา)
                </label>
                <input
                  id="maidenLastName"
                  type="text"
                  value={maidenLastName}
                  onChange={(e) => setMaidenLastName(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="รักเรียน"
                  className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
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
                placeholder="01122540"
                className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">รูปแบบ: วันที่(2หลัก) เดือน(2หลัก) ปี พ.ศ.(4หลัก) เช่น 01122540</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "กำลังยืนยัน..." : "ยืนยันตัวตน"}
              {!loading && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            <a href="/login" className="text-[var(--primary)] hover:underline font-medium">
              ← กลับไปเข้าสู่ระบบ
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

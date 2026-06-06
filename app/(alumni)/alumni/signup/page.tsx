"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";

export default function AlumniSignupPage() {
  return (
    <Suspense>
      <AlumniSignupForm />
    </Suspense>
  );
}

function AlumniSignupForm() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [cohort, setCohort] = useState("");
  const [firstName, setFirstName] = useState("");
  const [maidenLastName, setMaidenLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function formatBirthDate(value: string): string {
    return value.replace(/\D/g, "").slice(0, 8);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    if (!/^\d{8}$/.test(birthDate)) {
      setError("รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น DDMMYYYY");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/alumni-auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId.trim(),
          cohort: cohort.trim(),
          firstName: firstName.trim(),
          maidenLastName: maidenLastName.trim(),
          birthDate,
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาดในการลงทะเบียน");
        return;
      }

      // Redirect to login with success message
      router.push("/login?signup=success");
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
          <img src="/fon-cmu-logo.png" alt="FON CMU" className="h-10 w-auto" />
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
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <img src="/fon-cmu-logo.png" alt="FON CMU" className="mx-auto mb-3 h-16 w-auto" />
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identity verification fields */}
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

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--muted)]">ข้อมูลบัญชี</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            {/* Account fields */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                อีเมล
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="example@email.com"
                className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                รหัสผ่าน
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                ยืนยันรหัสผ่าน
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                className="w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>

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
            <a href="/login" className="text-[var(--primary)] hover:underline font-medium">
              เข้าสู่ระบบ
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

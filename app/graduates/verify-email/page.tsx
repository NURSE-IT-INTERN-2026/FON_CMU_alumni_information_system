"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BASE_PATH } from "@/lib/constants";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}

type Status = "verifying" | "success" | "error";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");

  // Auto-verify on mount: the email link lands here with ?token=…, so one click
  // confirms ownership. No form fields — the token alone flips UNVERIFIED → PENDING.
  // The no-token case is handled by the initial state ("error"), so this effect
  // only runs the fetch when a token is present.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_PATH}/api/alumni-auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!cancelled) setStatus(res.ok ? "success" : "error");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
            ยืนยันอีเมล
            <br />
            <span className="text-[var(--accent)]">คณะพยาบาลศาสตร์ มช.</span>
          </h1>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
        </div>
      </div>

      {/* Right panel — status */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 text-center lg:hidden">
            <img src={`${BASE_PATH}/fon-cmu-logo.png`} alt="FON CMU" className="mx-auto mb-3 h-16 w-auto" />
            <h1 className="text-lg font-bold text-[var(--foreground)]">ระบบสารสนเทศศิษย์เก่า</h1>
            <p className="text-sm text-[var(--muted)]">คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่</p>
          </div>

          {status === "verifying" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100">
                <svg className="h-8 w-8 animate-spin text-sky-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">กำลังยืนยันอีเมล...</h2>
              <p className="mt-3 text-sm text-[var(--muted)]">กรุณารอสักครู่</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">ยืนยันอีเมลสำเร็จ</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                อีเมลของท่านได้รับการยืนยันแล้ว บัญชีของท่านเข้าสู่ขั้นตอนการตรวจสอบโดยผู้ดูแลระบบ
                ท่านจะได้รับอีเมลแจ้งเตือนเมื่อบัญชีพร้อมใช้งาน
              </p>
              <a
                href={`${BASE_PATH}/login?verify=success`}
                className="mt-8 inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
              >
                กลับสู่หน้าเข้าสู่ระบบ
              </a>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg className="h-8 w-8 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">ลิงก์ไม่ถูกต้อง</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ยืนยันใหม่
              </p>
              <a
                href={`${BASE_PATH}/login`}
                className="mt-8 inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
              >
                กลับสู่หน้าเข้าสู่ระบบ
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

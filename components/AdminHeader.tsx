"use client";

import Link from "next/link";

export default function AdminHeader() {
  return (
    <header
      className="flex items-center justify-between px-6 py-3"
      style={{ backgroundColor: "#1e3a5f" }}
    >
      <div className="flex items-center gap-3">
        <img src="/fon-cmu-logo.png" alt="FON CMU" height={36} />
        <h1 className="text-lg font-semibold text-white">
          ระบบจัดการข้อมูลศิษย์เก่า
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-white">ผู้ดูแลระบบ</span>
        <Link
          href="/api/auth/logout"
          className="rounded bg-white/20 px-4 py-1.5 text-sm text-white hover:bg-white/30 transition-colors"
        >
          ออกจากระบบ
        </Link>
      </div>
    </header>
  );
}

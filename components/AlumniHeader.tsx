"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface AlumniHeaderProps {
  alumni: {
    prefix: string;
    firstName: string;
    maidenLastName: string;
    newLastName: string | null;
  };
}

export default function AlumniHeader({ alumni }: AlumniHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = `${alumni.prefix}${alumni.firstName} ${alumni.newLastName || alumni.maidenLastName}`;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/alumni-auth/logout", { method: "POST" });
      router.push("/alumni/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <img src="/fon-cmu-logo.png" alt="FON CMU" className="h-8 w-auto" />
          <div>
            <span className="text-sm font-semibold text-[var(--foreground)]">
              ระบบสารสนเทศศิษย์เก่า
            </span>
            <span className="ml-2 hidden text-xs text-[var(--muted)] sm:inline">
              คณะพยาบาลศาสตร์ มช.
            </span>
          </div>
        </div>

        {/* User info and logout */}
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-[var(--foreground)]">{displayName}</p>
            <p className="text-xs text-[var(--muted)]">ศิษย์เก่า</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--danger)] transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {loggingOut ? "กำลังออก..." : "ออกจากระบบ"}
          </button>
        </div>
      </div>
    </header>
  );
}

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
      router.push("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-[var(--primary)] text-white shadow-md">
      {/* Cyan gradient overlay on the left */}
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-2/5"
          style={{
            background:
              "linear-gradient(to right, rgba(0, 188, 212, 0.7) 0%, rgba(0, 188, 212, 0.4) 40%, transparent 100%)",
          }}
        />

        <div className="relative mx-auto flex max-w-full items-center justify-between px-5 py-3 sm:px-7 lg:px-9">
          {/* Logo & Title */}
          <div className="flex shrink-0 items-center gap-3">
            <img
              src="/fon-cmu-logo.png"
              alt="FON CMU Logo"
              className="h-16 w-auto"
            />
            <span className="hidden text-sm font-semibold leading-snug sm:block md:text-base">
              ระบบสารสนเทศศิษย์เก่า
              <br />
              คณะพยาบาลศาสตร์ มช.
            </span>
          </div>

          {/* User info and logout */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white/90">{displayName}</p>
              <p className="text-xs text-white/60">ศิษย์เก่า</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="cursor-pointer rounded-md bg-white/20 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/30 disabled:opacity-60"
            >
              {loggingOut ? "กำลังออก..." : "ออกจากระบบ"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

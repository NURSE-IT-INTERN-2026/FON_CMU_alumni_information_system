"use client";

import { useRouter, usePathname } from "next/navigation";
import { BASE_PATH } from "@/lib/constants";
import Link from "next/link";
import { useState } from "react";

interface AlumniHeaderProps {
  alumni: {
    prefix: string;
    firstName: string;
    lastName: string;
  };
}

const NAV_ITEMS = [
  { href: "/graduates/profile", label: "ข้อมูลส่วนตัว" },
  { href: "/graduates/news", label: "ข่าวสาร" },
];

export default function AlumniHeader({ alumni }: AlumniHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = `${alumni.prefix}${alumni.firstName} ${alumni.lastName}`;

  function isItemActive(href: string) {
    return href === "/graduates/profile"
      ? pathname === href
      : pathname.startsWith(href);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch(`${BASE_PATH}/api/alumni-auth/logout`, { method: "POST" });
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
              src={`${BASE_PATH}/fon-cmu-logo.png`}
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
              className="hidden cursor-pointer rounded-md bg-white/20 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/30 disabled:opacity-60 sm:inline-flex"
            >
              {loggingOut ? "กำลังออก..." : "ออกจากระบบ"}
            </button>

            {/* Hamburger button (mobile only) */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="เปิดเมนู"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="border-t border-white/10 lg:hidden">
          <div className="space-y-1 px-4 py-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isItemActive(item.href)
                    ? "bg-white/20 text-white"
                    : "text-white/90 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
            >
              {loggingOut ? "กำลังออก..." : "ออกจากระบบ"}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

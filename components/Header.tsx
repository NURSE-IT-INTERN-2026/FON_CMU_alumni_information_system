"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS, SETTINGS_NAV_ITEMS, BASE_PATH } from "@/lib/constants";
import { useRole, roleLabel } from "@/lib/role-context";

interface HeaderProps {
  user?: {
    firstName: string;
    lastName: string;
  };
}

export default function Header({ user }: HeaderProps = {}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const role = useRole();
  const isSuperAdmin = role === "superadmin";
  const showLogout = pathname !== "/login";
  const showSettings = pathname.startsWith("/management/settings");
  const displayName = user ? `${user.firstName} ${user.lastName}` : "";

  const items = showSettings
    ? SETTINGS_NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin)
    : NAV_ITEMS;

  const toggleSettings = () => {
    setMobileMenuOpen(false);
    router.push(showSettings ? "/management/dashboard" : "/management/settings/profile");
  };

  return (
    <header className="sticky top-0 z-50 bg-[var(--primary)] text-white shadow-md">
      {/* Top bar with cyan gradient overlay on the right */}
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
          <div className="flex items-center gap-3 shrink-0">
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

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Name & role (desktop) */}
            {showLogout && user && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-white/90">{displayName}</p>
                <p className="text-xs text-white/60">{roleLabel(role)}</p>
              </div>
            )}

            {/* Settings button (desktop) */}
            {showLogout && (
            <button
              type="button"
              onClick={toggleSettings}
              className={`hidden lg:flex items-center justify-center rounded-md p-2 transition-colors cursor-pointer ${
                showSettings
                  ? "bg-white/30"
                  : "hover:bg-white/10"
              }`}
              aria-label="ตั้งค่า"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
            </button>
            )}

            {showLogout && (
              <form action={`${BASE_PATH}/api/auth/logout`} method="POST">
                <button
                  type="submit"
                  className="rounded-md bg-white/20 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/30 cursor-pointer"
                >
                  ออกจากระบบ
                </button>
              </form>
            )}

            {/* Hamburger button (mobile only) */}
            {showLogout && (
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
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="border-t border-white/10 lg:hidden">
          <div className="space-y-1 px-4 py-3">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            {showLogout && (
            <button
              type="button"
              onClick={toggleSettings}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
              {showSettings ? "กลับเมนูหลัก" : "ตั้งค่า"}
            </button>
            )}
            {showLogout && (
              <form action={`${BASE_PATH}/api/auth/logout`} method="POST">
                <button
                  type="submit"
                  className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  ออกจากระบบ
                </button>
              </form>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/graduates/news", label: "ข่าวสาร" },
  { href: "/graduates/profile", label: "ข้อมูลส่วนตัว" },
];

// Desktop left navigation for the authenticated alumni portal.
// Mobile navigation is handled by the hamburger drawer in AlumniHeader.
export default function AlumniSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--card-bg)] lg:block">
      <nav className="sticky top-[4.5rem] flex h-[calc(100vh-4.5rem)] flex-col p-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/graduates/profile"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--foreground)] hover:bg-[var(--background)]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

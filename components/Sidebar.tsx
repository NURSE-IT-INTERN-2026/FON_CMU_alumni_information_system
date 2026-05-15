"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from "@/lib/constants";

export default function Sidebar() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const items = isAdmin ? ADMIN_NAV_ITEMS : NAV_ITEMS;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--card-bg)] lg:block">
      <nav className="sticky top-[4.5rem] flex h-[calc(100vh-4.5rem)] flex-col justify-between p-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
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
        {isAdmin && (
          <div className="border-t border-[var(--border)] pt-3">
            <Link
              href="/"
              className="block rounded-lg px-4 py-2.5 text-center text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--background)]"
            >
              กลับหน้าหลัก
            </Link>
          </div>
        )}
      </nav>
    </aside>
  );
}

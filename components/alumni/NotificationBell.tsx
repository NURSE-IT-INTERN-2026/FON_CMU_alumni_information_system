"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";

/**
 * Notification bell for the alumni header (community V2). Polls the unread
 * count once a minute; links into the notification center. Badge color is
 * tuned for the purple header (unlike the admin sidebar's red badge).
 */
export default function NotificationBell() {
  const { data } = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => apiFetch<{ count: number }>("/api/notifications/unread-count"),
    refetchInterval: 60_000,
    // A 401 mid-session redirects via apiFetch; a failed probe just hides the badge.
    retry: false,
  });

  const count = data?.count ?? 0;

  return (
    <Link
      href="/graduates/notifications"
      aria-label={count > 0 ? `การแจ้งเตือน (มี ${count > 99 ? "99+" : count} รายการที่ยังไม่ได้อ่าน)` : "การแจ้งเตือน"}
      className="relative inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10"
      title="การแจ้งเตือน"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
        />
      </svg>
      {count > 0 && (
        <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-[var(--primary-dark)]">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

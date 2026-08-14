"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { BASE_PATH } from "@/lib/constants";

/**
 * Notification center (community V2) — the logged-in alum's own list, unread
 * first. Stored `link` values are basePath-relative; rendered with BASE_PATH
 * prepended.
 */

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
interface Paged<T> {
  data: T[];
  total: number;
  unreadCount: number;
  totalPages: number;
}

const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
function formatThaiDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const NOTIFICATION_PAGE_SIZE = 20;

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.notifications.list({ page }),
    queryFn: () =>
      apiFetch<Paged<NotificationItem>>(
        `/api/notifications?page=${page}&pageSize=${NOTIFICATION_PAGE_SIZE}`,
      ),
  });

  const markRead = useMutation({
    mutationFn: (payload: { ids?: string[]; all?: boolean }) =>
      apiFetch("/api/notifications", { method: "POST", json: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          การแจ้งเตือน {unreadCount > 0 && <span className="text-base font-normal text-[var(--muted)]">({unreadCount} ที่ยังไม่ได้อ่าน)</span>}
        </h1>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markRead.mutate({ all: true })} disabled={markRead.isPending}>
            {markRead.isPending ? "กำลังบันทึก..." : "ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว"}
          </Button>
        )}
      </div>

      {isPending ? (
        <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm"><p className="text-[var(--muted)]">ยังไม่มีการแจ้งเตือน</p></div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const content = (
              <div
                className={`rounded-lg bg-white p-4 shadow-sm transition-colors ${n.readAt ? "" : "border-l-4 border-[var(--primary)]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-sm ${n.readAt ? "text-[var(--foreground)]" : "font-semibold text-[var(--foreground)]"}`}>{n.title}</p>
                  {!n.readAt && (
                    <button
                      onClick={() => markRead.mutate({ ids: [n.id] })}
                      disabled={markRead.isPending}
                      className="shrink-0 text-xs text-[var(--muted)] hover:underline"
                    >
                      ทำเครื่องหมายว่าอ่านแล้ว
                    </button>
                  )}
                </div>
                {n.body && <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{n.body}</p>}
                <p className="mt-2 text-xs text-[var(--muted)]">{formatThaiDateTime(n.createdAt)}</p>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={`${BASE_PATH}${n.link}`} onClick={() => !n.readAt && markRead.mutate({ ids: [n.id] })}>
                {content}
              </Link>
            ) : (
              <div key={n.id}>{content}</div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
          <span className="text-sm text-[var(--muted)]">หน้า {page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
        </div>
      )}
    </div>
  );
}

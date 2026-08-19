"use client";

import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import ForumBody from "@/components/forum/ForumBody";

/**
 * Staff announcements for the alumni community (V2) — read-only list, pinned
 * first. The "ใหม่" badge comes from the `?since=true` watermark comparison;
 * viewing the page stamps the watermark (POST mark-read), clearing the badge
 * on the next fetch.
 */

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  pinnedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  authorUser: { id: string; firstName: string; lastName: string } | null;
}

const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export default function AlumniAnnouncementsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.announcements.list(),
    queryFn: () =>
      apiFetch<{ data: AnnouncementItem[]; newCount?: number }>("/api/announcements?since=true"),
  });

  const markRead = useMutation({
    mutationFn: () => apiFetch("/api/announcements/mark-read", { method: "POST" }),
  });

  // Stamp the watermark once the list has loaded (clears the ใหม่ badge on
  // the next visit). No setState here — render state stays simple.
  useEffect(() => {
    if (!isPending && data) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, data]);

  const announcements = data?.data ?? [];
  const newCount = data?.newCount ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">ประกาศจากคณะ</h1>
        {newCount > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
            ใหม่ {newCount}
          </span>
        )}
      </div>

      {isPending ? (
        <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div>
      ) : isError ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm"><p className="text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</p></div>
      ) : announcements.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm"><p className="text-[var(--muted)]">ยังไม่มีประกาศ</p></div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg bg-white p-4 shadow-sm ${a.pinnedAt ? "border-l-4 border-[var(--accent)]" : ""}`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-[var(--foreground)]">
                  {a.pinnedAt && (
                    <svg className="mr-2 inline h-4 w-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M9 4h6v4.2l2.1 3.4a1 1 0 0 1-.85 1.5H13v6.4a1 1 0 0 1-2 0v-6.4H7.75a1 1 0 0 1-.85-1.5L9 8.2V4Z" />
                    </svg>
                  )}
                  {a.title}
                </h3>
                <span className="shrink-0 text-xs text-[var(--muted)]">{formatThaiDate(a.createdAt)}</span>
              </div>
              <ForumBody text={a.body} />
              {a.authorUser && (
                <p className="mt-3 border-t border-[var(--border)] pt-2 text-xs text-[var(--muted)]">
                  โดย {a.authorUser.firstName} {a.authorUser.lastName}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

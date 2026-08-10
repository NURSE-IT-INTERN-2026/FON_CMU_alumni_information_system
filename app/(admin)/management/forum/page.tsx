"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useCanWrite } from "@/lib/role-context";
import { Button } from "@/components/ui/button";
import {
  CONTENT_REPORT_STATUS_VALUES,
  CONTENT_REPORT_STATUS_LABELS,
  FORUM_REPORT_REASON_LABELS,
} from "@/lib/validations";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function publicName(a: AlumniPublicIdentity | null | undefined): string {
  if (!a) return "—";
  return `${a.prefix}${a.firstName} ${a.lastName}`.trim();
}

interface ReportedTarget {
  id: string;
  title?: string;
  body: string;
  deletedAt: string | null;
  createdAt: string;
  author: AlumniPublicIdentity;
  topicId?: string;
}
interface ForumReport {
  id: string;
  resourceType: "FORUM_TOPIC" | "FORUM_REPLY";
  resourceId: string;
  reason: keyof typeof FORUM_REPORT_REASON_LABELS;
  reasonDetail: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  resolutionNote: string | null;
  createdAt: string;
  reporter: AlumniPublicIdentity;
  resolver: { id: string; firstName: string; lastName: string } | null;
  topic: ReportedTarget | null;
  reply: ReportedTarget | null;
}

type StatusFilter = "OPEN" | "RESOLVED" | "DISMISSED";

export default function ForumModerationPage() {
  const canWrite = useCanWrite();
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("OPEN");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.forum.reports({ page, status, resourceType: "" }),
    queryFn: () =>
      apiFetch<{ data: ForumReport[]; total: number; totalPages: number }>(
        `/api/forum/reports?status=${status}&page=${page}`,
      ),
  });
  const reports = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  function bust() {
    setError(null);
    qc.invalidateQueries({ queryKey: queryKeys.forum.reports({ page, status, resourceType: "" }) });
  }

  const act = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: "resolve" | "dismiss"; note?: string }) =>
      apiFetch(`/api/forum/reports/${id}`, { method: "POST", json: { action, ...(note ? { note } : {}) } }),
    onSuccess: bust,
    onError: (e) => setError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  const hide = useMutation({
    mutationFn: (r: ForumReport) =>
      r.resourceType === "FORUM_TOPIC"
        ? apiFetch(`/api/forum/topics/${r.resourceId}`, { method: "DELETE" })
        : apiFetch(`/api/forum/replies/${r.resourceId}`, { method: "DELETE" }),
    onSuccess: bust,
    onError: (e) => setError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">กระดานสนทนา</h1>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6 flex gap-2">
        {CONTENT_REPORT_STATUS_VALUES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              status === s
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-gray-100"
            }`}
          >
            {CONTENT_REPORT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
      )}

      {isPending ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-[var(--muted)]">ไม่มีรายงานในสถานะนี้</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => {
            const target = r.topic ?? r.reply;
            const isTopic = r.resourceType === "FORUM_TOPIC";
            return (
              <div key={r.id} className="rounded-lg bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                    {FORUM_REPORT_REASON_LABELS[r.reason]}
                  </span>
                  <span className="text-[var(--muted)]">
                    {isTopic ? "กระทู้" : "ความคิดเห็น"}
                  </span>
                  <span className="text-[var(--muted)]">·</span>
                  <span className="text-[var(--muted)]">รายงานเมื่อ {formatThaiDate(r.createdAt)}</span>
                  {target?.deletedAt && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-500">ถูกลบแล้ว</span>
                  )}
                </div>

                {/* Reported content */}
                {target ? (
                  <div className="mb-3 rounded-md bg-gray-50 p-3">
                    {isTopic && <p className="mb-1 font-semibold text-[var(--foreground)]">{target.title}</p>}
                    <p className="line-clamp-3 text-sm text-[var(--foreground)]">{target.body}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      โดย {publicName(target.author)} ·{" "}
                      <Link href={`/management/alumni/${target.author.id}`} className="text-[var(--primary)] hover:underline">
                        ดูโพรไฟล์เต็ม
                      </Link>
                    </p>
                  </div>
                ) : (
                  <p className="mb-3 text-sm text-[var(--muted)] italic">เนื้อหาถูกลบไปแล้ว</p>
                )}

                {r.reasonDetail && (
                  <p className="mb-3 text-sm text-[var(--muted)]">รายละเอียด: {r.reasonDetail}</p>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--muted)]">รายงานโดย {publicName(r.reporter)}</p>
                  <div className="flex flex-wrap gap-2">
                    {r.status === "OPEN" && canWrite && target && !target.deletedAt && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={hide.isPending}
                        onClick={() => hide.mutate(r)}
                      >
                        ซ่อน/ลบเนื้อหา
                      </Button>
                    )}
                    {r.status === "OPEN" && canWrite && (
                      <>
                        <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "resolve" })}>
                          ดำเนินการแก้ไขแล้ว
                        </Button>
                        <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "dismiss" })}>
                          ยกเลิก
                        </Button>
                      </>
                    )}
                    {r.status !== "OPEN" && r.resolver && (
                      <span className="text-xs text-[var(--muted)]">
                        {r.status === "RESOLVED" ? "ดำเนินการแล้ว" : "ยกเลิก"} โดย {r.resolver.firstName} {r.resolver.lastName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1.5">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button>
          <span className="px-2 text-sm text-[var(--muted)]">หน้า {page}/{totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button>
        </div>
      )}
    </div>
  );
}

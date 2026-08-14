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
import { assetUrl } from "@/lib/asset-url";

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
  body?: string;
  description?: string;
  imageUrl?: string | null;
  deletedAt: string | null;
  createdAt: string;
  author?: AlumniPublicIdentity;
  organizerAlumni?: AlumniPublicIdentity | null;
  organizerUser?: { id: string; firstName: string; lastName: string } | null;
  authorAlumni?: AlumniPublicIdentity | null;
  authorUser?: { id: string; firstName: string; lastName: string } | null;
  workplace?: string;
  eventId?: string;
  uploader?: AlumniPublicIdentity | null;
}
interface ForumReport {
  id: string;
  resourceType: "FORUM_TOPIC" | "FORUM_REPLY" | "EVENT" | "FEED_POST" | "FEED_COMMENT" | "JOB_POSTING" | "EVENT_PHOTO";
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
  event: ReportedTarget | null;
  feedPost: ReportedTarget | null;
  feedComment: ReportedTarget | null;
  jobPosting: ReportedTarget | null;
  eventPhoto: ReportedTarget | null;
}

const RESOURCE_LABELS: Record<ForumReport["resourceType"], string> = {
  FORUM_TOPIC: "กระทู้",
  FORUM_REPLY: "ความคิดเห็น (กระดานสนทนา)",
  EVENT: "กิจกรรม",
  FEED_POST: "โพสต์ (ฟีด)",
  FEED_COMMENT: "ความคิดเห็น (ฟีด)",
  JOB_POSTING: "ประกาศงาน",
  EVENT_PHOTO: "รูปภาพกิจกรรม",
};

/** Uniform descriptor for a reported item, regardless of resource type, so the
 * card can render + delete it generically. Returns null if the target is gone. */
function describeReport(r: ForumReport) {
  const t =
    r.resourceType === "FORUM_TOPIC" ? r.topic
    : r.resourceType === "FORUM_REPLY" ? r.reply
    : r.resourceType === "EVENT" ? r.event
    : r.resourceType === "FEED_POST" ? r.feedPost
    : r.resourceType === "JOB_POSTING" ? r.jobPosting
    : r.resourceType === "EVENT_PHOTO" ? r.eventPhoto
    : r.feedComment;
  if (!t) return null;
  const deleteUrl =
    r.resourceType === "FORUM_TOPIC" ? `/api/forum/topics/${r.resourceId}`
    : r.resourceType === "FORUM_REPLY" ? `/api/forum/replies/${r.resourceId}`
    : r.resourceType === "EVENT" ? `/api/events/${r.resourceId}`
    : r.resourceType === "FEED_POST" ? `/api/feed/${r.resourceId}`
    : r.resourceType === "JOB_POSTING" ? `/api/jobs/${r.resourceId}`
    : r.resourceType === "EVENT_PHOTO" ? `/api/events/${t.eventId ?? ""}/photos/${r.resourceId}`
    : `/api/feed/comments/${r.resourceId}`;
  const staffName = t.organizerUser
    ? `${t.organizerUser.firstName} ${t.organizerUser.lastName}`.trim()
    : t.authorUser
      ? `${t.authorUser.firstName} ${t.authorUser.lastName}`.trim()
      : null;
  return {
    label: RESOURCE_LABELS[r.resourceType],
    title: t.title ?? null,
    subtitle: "workplace" in t && t.workplace ? t.workplace : null,
    body: t.body ?? t.description ?? "",
    imageUrl: "imageUrl" in t ? t.imageUrl ?? null : null,
    deleted: !!t.deletedAt,
    deleteUrl,
    author: t.author ?? t.organizerAlumni ?? t.authorAlumni ?? t.uploader ?? null,
    staffName,
  };
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
    mutationFn: (desc: { deleteUrl: string }) => apiFetch(desc.deleteUrl, { method: "DELETE" }),
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
            const desc = describeReport(r);
            return (
              <div key={r.id} className="rounded-lg bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                    {FORUM_REPORT_REASON_LABELS[r.reason]}
                  </span>
                  <span className="text-[var(--muted)]">{desc?.label ?? RESOURCE_LABELS[r.resourceType]}</span>
                  <span className="text-[var(--muted)]">·</span>
                  <span className="text-[var(--muted)]">รายงานเมื่อ {formatThaiDate(r.createdAt)}</span>
                  {desc?.deleted && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-500">ถูกลบแล้ว</span>
                  )}
                </div>

                {/* Reported content */}
                {desc ? (
                  <div className="mb-3 rounded-md bg-gray-50 p-3">
                    {desc.title && <p className="mb-1 font-semibold text-[var(--foreground)]">{desc.title}</p>}
                    {desc.subtitle && <p className="mb-1 text-xs text-[var(--muted)]">{desc.subtitle}</p>}
                    {desc.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl(desc.imageUrl)} alt="รูปที่ถูกรายงาน" className="mb-2 max-h-48 rounded-md object-cover" />
                    )}
                    {desc.body && <p className="line-clamp-3 text-sm text-[var(--foreground)]">{desc.body}</p>}
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      โดย {desc.author ? (
                        <>
                          {publicName(desc.author)} ·{" "}
                          <Link href={`/management/alumni/${desc.author.id}`} className="text-[var(--primary)] hover:underline">ดูโพรไฟล์เต็ม</Link>
                        </>
                      ) : desc.staffName ? (
                        `เจ้าหน้าที่: ${desc.staffName}`
                      ) : "—"}
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
                    {r.status === "OPEN" && canWrite && desc && !desc.deleted && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={hide.isPending}
                        onClick={() => hide.mutate(desc)}
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

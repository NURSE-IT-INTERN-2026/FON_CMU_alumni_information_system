"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import SearchInput from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import PhotoAvatar from "@/components/forum/PhotoAvatar";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";
import { FORUM_SORT_VALUES, FORUM_SORT_LABELS } from "@/lib/validations";

const FORUM_PAGE_SIZE = 10;

const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
}

interface ForumTopicItem {
  id: string;
  title: string;
  body: string;
  replyCount: number;
  lastReplyAt: string | null;
  createdAt: string;
  author: AlumniPublicIdentity;
}

interface Paged<T> {
  data: T[];
  total: number;
  totalPages: number;
}

export default function AlumniForumPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string>("newest");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  // Membership (opt-in state). GET never 403s — only 401 (→ login redirect).
  const { data: membership, isPending: membershipLoading } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () => apiFetch<{ optedIn: boolean; optedInAt: string | null }>(
      "/api/alumni-profile/community-membership",
    ),
  });
  const optedIn = membership?.optedIn ?? false;

  const joinMutation = useMutation({
    mutationFn: (action: "opt-in" | "opt-out") =>
      apiFetch<{ optedIn: boolean }>("/api/alumni-profile/community-membership", {
        method: "POST",
        json: { action },
      }),
    onSuccess: () => {
      setJoinError(null);
      setLeaveError(null);
      setShowLeaveConfirm(false);
      qc.invalidateQueries({ queryKey: queryKeys.forum.all });
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง";
      setJoinError(msg);
      setLeaveError(msg);
    },
  });

  // Topic list — only enabled once opted in (avoids a 403 NOT_OPTED_IN fetch).
  const { data: topicsData, isPending: topicsLoading, isError } = useQuery({
    queryKey: queryKeys.forum.topics({ page, search, sort }),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(FORUM_PAGE_SIZE),
        sort,
        // Forum-wide topics only — group-scoped topics live in their group's
        // space (/graduates/groups/[slug]).
        groupId: "none",
      });
      if (search) params.set("search", search);
      return apiFetch<Paged<ForumTopicItem>>(`/api/forum/topics?${params}`);
    },
    enabled: optedIn,
  });

  const topics = topicsData?.data ?? [];
  const total = topicsData?.total ?? 0;
  const totalPages = topicsData?.totalPages ?? 1;

  // --- Join card (not opted in) ---
  if (!membershipLoading && !optedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-white p-8 shadow-sm" data-tour="forum-join-card">
          <h1 className="mb-3 text-2xl font-bold text-[var(--primary)]" data-tour="forum-heading">กระดานสนทนาศิษย์เก่า</h1>
          <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
            กระดานสนทนาเป็นพื้นที่สำหรับศิษย์เก่าพบปะแลกเปลี่ยนความรู้ ประสบการณ์ และข่าวสาร
            การเข้าร่วมเป็นการให้ความยินยอมให้ศิษย์เก่าท่านอื่นที่เข้าร่วมเห็นข้อมูลของท่าน
            (คำนำหน้า ชื่อ นามสกุล รุ่น ระดับปริญญา และรูปประจำตัว) บนเนื้อหาที่ท่านโพสต์
          </p>
          <p className="mb-6 text-sm leading-relaxed text-[var(--muted)]">
            ท่านสามารถยกเลิกการเข้าร่วมได้ทุกเมื่อ โดยโพสต์ที่ท่านเคยสร้างไว้จะยังคงแสดงชื่อของท่านอยู่
          </p>
          {joinError && <p className="mb-4 text-sm text-red-600">{joinError}</p>}
          <Button
            onClick={() => joinMutation.mutate("opt-in")}
            disabled={joinMutation.isPending}
            className="w-full sm:w-auto"
          >
            {joinMutation.isPending ? "กำลังเข้าร่วม..." : "เข้าร่วมชุมชน"}
          </Button>
        </div>
      </div>
    );
  }

  if (membershipLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  const paginationNumbers = (() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  })();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl" data-tour="forum-heading">กระดานสนทนา</h1>
        <div className="flex items-center gap-2">
          <Link href="/graduates/forum/new" data-tour="forum-new-topic">
            <Button>ตั้งกระทู้ใหม่</Button>
          </Link>
          <Button variant="ghost" onClick={() => setShowLeaveConfirm(true)} className="text-sm">
            ออกจากชุมชน
          </Button>
        </div>
      </div>

      {/* Search + sort */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row" data-tour="forum-search">
        <SearchInput
          value={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          placeholder="ค้นหากระทู้..."
          formClassName="flex-1"
        />
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
        >
          {FORUM_SORT_VALUES.map((s) => (
            <option key={s} value={s}>{FORUM_SORT_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {topicsLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</p>
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm" data-tour="forum-list">
          <p className="text-[var(--muted)]">ยังไม่มีกระทู้ในกระดานสนทนา</p>
          <Link href="/graduates/forum/new">
            <Button className="mt-4">ตั้งกระทู้ใหม่</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3" data-tour="forum-list">
          {topics.map((t) => (
            <Link
              key={t.id}
              href={`/graduates/forum/${t.id}`}
              className="block rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-[var(--foreground)] hover:text-[var(--primary)]">
                  {t.title}
                </h3>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  {t.replyCount} ความคิดเห็น
                </span>
              </div>
              <p className="mb-3 line-clamp-2 text-sm text-[var(--muted)]">{t.body}</p>
              <div className="flex items-center justify-between">
                <PhotoAvatar identity={t.author} size="sm" />
                <span className="text-xs text-[var(--muted)]">
                  {formatThaiDate(t.lastReplyAt ?? t.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
          >
            ก่อนหน้า
          </button>
          {paginationNumbers.map((p, i) =>
            p === "..." ? (
              <span key={`dot-${i}`} className="px-2 text-gray-400">...</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`rounded-md px-3 py-1.5 text-sm ${p === page ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"}`}
              >
                {p}
              </button>
            ),
          )}
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
          >
            ถัดไป
          </button>
        </div>
      )}

      {/* Leave-community confirm dialog */}
      <Modal
        open={showLeaveConfirm}
        onOpenChange={(o) => { if (!o) setShowLeaveConfirm(false); }}
        title="ออกจากชุมชน"
        description="ท่านจะไม่สามารถอ่านหรือโพสต์ในกระดานสนทนาได้อีก โพสต์ที่ท่านเคยสร้างไว้จะยังคงแสดงชื่อของท่านอยู่ ท่านสามารถเข้าร่วมใหม่ได้ในภายหลัง"
        size="sm"
        showCloseButton={false}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)} disabled={joinMutation.isPending}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => joinMutation.mutate("opt-out")}
              disabled={joinMutation.isPending}
            >
              {joinMutation.isPending ? "กำลังดำเนินการ..." : "ออกจากชุมชน"}
            </Button>
          </>
        }
      >
        {leaveError && <p className="text-sm text-red-600">{leaveError}</p>}
      </Modal>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        แสดง {topics.length} จาก {total} กระทู้
      </p>
    </div>
  );
}

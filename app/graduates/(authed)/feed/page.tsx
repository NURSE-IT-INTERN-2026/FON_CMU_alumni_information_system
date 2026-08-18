"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { BASE_PATH } from "@/lib/constants";
import { assetUrl } from "@/lib/asset-url";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import PhotoAvatar from "@/components/forum/PhotoAvatar";
import ForumBody from "@/components/forum/ForumBody";
import ReportDialog from "@/components/forum/ReportDialog";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

const PAGE_SIZE = 10;
const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
}

interface FeedItem {
  id: string;
  authorId: string;
  body: string;
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  author: AlumniPublicIdentity;
}
interface Paged<T> { data: T[]; total: number; totalPages: number; }

export default function AlumniFeedPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [composer, setComposer] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  const { data: membership, isPending: membershipLoading } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () => apiFetch<{ alumniId: string; optedIn: boolean }>("/api/alumni-profile/community-membership"),
  });
  const optedIn = membership?.optedIn ?? false;
  const myId = membership?.alumniId;

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.feed.list({ page }),
    queryFn: () => apiFetch<Paged<FeedItem>>(`/api/feed?page=${page}&pageSize=${PAGE_SIZE}`),
    enabled: optedIn,
  });
  const posts = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const bust = () => qc.invalidateQueries({ queryKey: queryKeys.feed.all });

  const createPost = useMutation({
    mutationFn: () =>
      apiFetch("/api/feed", { method: "POST", json: { body: composer.trim(), imageUrl: imageUrl ?? undefined } }),
    onSuccess: () => { setComposer(""); setImageUrl(null); setComposerError(null); bust(); },
    onError: (e) => setComposerError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  async function uploadPhoto(file: File) {
    setUploading(true);
    setComposerError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE_PATH}/api/alumni-upload`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "อัปโหลดไม่สำเร็จ");
      }
      const { url } = await res.json();
      setImageUrl(url);
    } catch (e) {
      setComposerError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  const like = useMutation({
    mutationFn: (id: string) => apiFetch<{ liked: boolean; likeCount: number }>(`/api/feed/${id}/like`, { method: "POST" }),
    // Optimistic-ish: just refetch the list. The count updates via invalidate.
    onSuccess: () => bust(),
  });

  const removePost = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/feed/${id}`, { method: "DELETE" }),
    onSuccess: () => { setDeletePostId(null); bust(); },
  });

  // --- Join card (not opted in) ---
  if (!membershipLoading && !optedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-white p-8 shadow-sm">
          <h1 className="mb-3 text-2xl font-bold text-[var(--primary)]">ฟีดศิษย์เก่า</h1>
          <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
            ฟีดเป็นพื้นที่แบ่งปันความคืบหน้า ภาพ และประสบการณ์ระหว่างศิษย์เก่า
            การเข้าร่วมเป็นการให้ความยินยอมให้ศิษย์เก่าที่เข้าร่วมเห็นข้อมูลของท่านบนโพสต์ของท่าน
          </p>
          <OptInButton />
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-[var(--primary)] sm:text-3xl">ฟีดศิษย์เก่า</h1>

      {/* Composer */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
        <textarea
          className="w-full resize-none rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          rows={3}
          maxLength={10000}
          placeholder="แบ่งปันสิ่งใหม่ๆ ให้ศิษย์เก่าด้วยกัน…"
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
        />
        {imageUrl && (
          <div className="relative mt-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl(imageUrl)} alt="preview" className="max-h-48 rounded-md object-cover" />
            <button onClick={() => setImageUrl(null)} className="absolute right-1 top-1 rounded-full bg-black/60 px-2 text-xs text-white">× ลบ</button>
          </div>
        )}
        {composerError && <p className="mt-2 text-sm text-red-600">{composerError}</p>}
        <div className="mt-2 flex items-center justify-between">
          <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-[var(--primary)] hover:underline">
            <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.currentTarget.value = ""; }} />
            {uploading ? "กำลังอัปโหลด…" : "📷 เพิ่มรูป"}
          </label>
          <Button onClick={() => createPost.mutate()} disabled={createPost.isPending || (!composer.trim() && !imageUrl)}>
            {createPost.isPending ? "กำลังโพสต์…" : "โพสต์"}
          </Button>
        </div>
      </div>

      {/* Stream */}
      {isPending ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : isError ? (
        <p className="py-10 text-center text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</p>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--muted)]">ยังไม่มีโพสต์ เริ่มแบ่งปันสิ่งแรกได้เลย</p>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => {
            const isOwn = !!myId && myId === p.authorId;
            return (
              <article key={p.id} className="rounded-lg bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <PhotoAvatar identity={p.author} size="sm" />
                  <span className="text-xs text-[var(--muted)]">{formatThaiDate(p.createdAt)}</span>
                </div>
                {p.body && <ForumBody text={p.body} />}
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(p.imageUrl)} alt="" className="mt-3 max-h-96 w-full rounded-md object-cover" />
                )}
                <div className="mt-3 flex items-center gap-4 border-t border-[var(--border)] pt-2 text-sm">
                  <button
                    onClick={() => like.mutate(p.id)}
                    disabled={like.isPending}
                    className={`font-medium ${p.likedByMe ? "text-[var(--primary)]" : "text-[var(--muted)]"} hover:opacity-80`}
                  >
                    {p.likedByMe ? "❤️" : "🤍"} {p.likeCount}
                  </button>
                  <Link href={`/graduates/feed/${p.id}`} className="text-[var(--muted)] hover:text-[var(--primary)]">
                    💬 {p.commentCount}
                  </Link>
                  <button onClick={() => setReportPostId(p.id)} className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--primary)]">รายงาน</button>
                  {isOwn && (
                    <button onClick={() => setDeletePostId(p.id)} className="text-xs text-red-600 hover:underline">ลบ</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1.5">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button>
          <span className="px-2 text-sm text-[var(--muted)]">หน้า {page}/{totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button>
        </div>
      )}

      {reportPostId && (
        <ReportDialog resourceType="FEED_POST" resourceId={reportPostId} open onOpenChange={(v) => { if (!v) setReportPostId(null); }} />
      )}
      <ConfirmDialog
        open={!!deletePostId}
        onOpenChange={(o) => { if (!o) setDeletePostId(null); }}
        title="ลบโพสต์"
        description="ต้องการลบโพสต์นี้ใช่หรือไม่"
        confirmLabel="ลบ"
        onConfirm={() => { if (deletePostId) removePost.mutate(deletePostId); }}
        loading={removePost.isPending}
      />
    </div>
  );
}

function OptInButton() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (action: "opt-in" | "opt-out") =>
      apiFetch("/api/alumni-profile/community-membership", { method: "POST", json: { action } }),
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: queryKeys.forum.all }); },
    onError: (e) => setError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });
  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <Button onClick={() => m.mutate("opt-in")} disabled={m.isPending} className="w-full sm:w-auto">
        {m.isPending ? "กำลังเข้าร่วม…" : "เข้าร่วมชุมชน"}
      </Button>
    </>
  );
}

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { assetUrl } from "@/lib/asset-url";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import PhotoAvatar from "@/components/forum/PhotoAvatar";
import ForumBody from "@/components/forum/ForumBody";
import ReportDialog from "@/components/forum/ReportDialog";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
}

interface FeedComment { id: string; authorId: string; body: string; createdAt: string; author: AlumniPublicIdentity; }
interface FeedPost {
  id: string; authorId: string; body: string; imageUrl: string | null;
  likeCount: number; commentCount: number; likedByMe: boolean; createdAt: string;
  author: AlumniPublicIdentity; comments: FeedComment[];
}

export default function FeedPostPage() {
  const { id: postId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: membership } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () => apiFetch<{ alumniId: string }>("/api/alumni-profile/community-membership"),
  });
  const myId = membership?.alumniId;

  const { data: post, isPending, isError, error } = useQuery({
    queryKey: queryKeys.feed.post(postId),
    queryFn: () => apiFetch<FeedPost>(`/api/feed/${postId}`),
  });

  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [report, setReport] = useState<{ type: "FEED_POST" | "FEED_COMMENT"; resourceId: string } | null>(null);
  const [delComment, setDelComment] = useState<string | null>(null);
  const [editPost, setEditPost] = useState(false);
  const [editPostText, setEditPostText] = useState("");
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  const bust = () => qc.invalidateQueries({ queryKey: queryKeys.feed.all });

  const like = useMutation({
    mutationFn: () => apiFetch<{ liked: boolean; likeCount: number }>(`/api/feed/${postId}/like`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed.post(postId) }),
  });
  const addComment = useMutation({
    mutationFn: () => apiFetch(`/api/feed/${postId}/comments`, { method: "POST", json: { body: commentText.trim() } }),
    onSuccess: () => { setCommentText(""); setCommentError(null); qc.invalidateQueries({ queryKey: queryKeys.feed.post(postId) }); bust(); },
    onError: (e) => setCommentError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });
  const removeComment = useMutation({
    mutationFn: (cid: string) => apiFetch(`/api/feed/comments/${cid}`, { method: "DELETE" }),
    onSuccess: () => { setDelComment(null); qc.invalidateQueries({ queryKey: queryKeys.feed.post(postId) }); bust(); },
  });
  const removePost = useMutation({
    mutationFn: () => apiFetch(`/api/feed/${postId}`, { method: "DELETE" }),
    onSuccess: () => { bust(); router.push("/graduates/feed"); },
  });
  const savePost = useMutation({
    mutationFn: (body: string) => apiFetch(`/api/feed/${postId}`, { method: "PUT", json: { body } }),
    onSuccess: () => { setEditPost(false); qc.invalidateQueries({ queryKey: queryKeys.feed.post(postId) }); },
  });
  const saveComment = useMutation({
    mutationFn: ({ cid, body }: { cid: string; body: string }) =>
      apiFetch(`/api/feed/comments/${cid}`, { method: "PUT", json: { body } }),
    onSuccess: () => { setEditCommentId(null); qc.invalidateQueries({ queryKey: queryKeys.feed.post(postId) }); },
  });

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }
  if (isError || !post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-[var(--muted)]">{error instanceof ApiError && error.status === 404 ? "ไม่พบโพสต์" : "เกิดข้อผิดพลาด"}</p>
        <Link href="/graduates/feed"><Button variant="outline" className="mt-4">กลับสู่ฟีด</Button></Link>
      </div>
    );
  }

  const isOwn = !!myId && myId === post.authorId;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/graduates/feed" className="text-sm text-[var(--muted)] hover:text-[var(--primary)]">← กลับสู่ฟีด</Link>

      {/* Post */}
      <article className="mt-4 rounded-lg bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <PhotoAvatar identity={post.author} size="sm" />
          <span className="text-xs text-[var(--muted)]">{formatThaiDate(post.createdAt)}</span>
        </div>
        {editPost ? (
          <div className="space-y-2">
            <textarea
              className="w-full resize-none rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
              rows={4}
              maxLength={10000}
              value={editPostText}
              onChange={(e) => setEditPostText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditPost(false)} disabled={savePost.isPending}>ยกเลิก</Button>
              <Button size="sm" onClick={() => savePost.mutate(editPostText.trim())} disabled={savePost.isPending || !editPostText.trim()}>
                {savePost.isPending ? "กำลังบันทึก…" : "บันทึก"}
              </Button>
            </div>
          </div>
        ) : (
          post.body && <ForumBody text={post.body} />
        )}
        {post.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(post.imageUrl)} alt="" className="mt-3 max-h-96 w-full rounded-md object-cover" />
        )}
        <div className="mt-3 flex items-center gap-4 border-t border-[var(--border)] pt-2 text-sm">
          <button onClick={() => like.mutate()} disabled={like.isPending} className={`font-medium ${post.likedByMe ? "text-[var(--primary)]" : "text-[var(--muted)]"} hover:opacity-80`}>
            {post.likedByMe ? "❤️" : "🤍"} {post.likeCount}
          </button>
          <span className="text-[var(--muted)]">💬 {post.commentCount}</span>
          <button onClick={() => setReport({ type: "FEED_POST", resourceId: post.id })} className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--primary)]">รายงาน</button>
          {isOwn && <button onClick={() => { setEditPostText(post.body); setEditPost(true); }} className="text-xs text-[var(--muted)] hover:text-[var(--primary)]">แก้ไข</button>}
          {isOwn && <button onClick={() => removePost.mutate()} className="text-xs text-red-600 hover:underline" disabled={removePost.isPending}>ลบ</button>}
        </div>
      </article>

      {/* Comments */}
      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold">ความคิดเห็น ({post.commentCount})</h2>
        {post.comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted)]">ยังไม่มีความคิดเห็น</p>
        ) : (
          post.comments.map((c) => {
            const cOwn = !!myId && myId === c.authorId;
            return (
              <div key={c.id} className="rounded-lg bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <PhotoAvatar identity={c.author} size="sm" />
                  <span className="text-xs text-[var(--muted)]">{formatThaiDate(c.createdAt)}</span>
                </div>
                {editCommentId === c.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full resize-none rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      rows={3}
                      maxLength={10000}
                      value={editCommentText}
                      onChange={(e) => setEditCommentText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditCommentId(null)} disabled={saveComment.isPending}>ยกเลิก</Button>
                      <Button size="sm" onClick={() => saveComment.mutate({ cid: c.id, body: editCommentText.trim() })} disabled={saveComment.isPending || !editCommentText.trim()}>
                        {saveComment.isPending ? "กำลังบันทึก…" : "บันทึก"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ForumBody text={c.body} />
                )}
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <button onClick={() => setReport({ type: "FEED_COMMENT", resourceId: c.id })} className="text-[var(--muted)] hover:text-[var(--primary)]">รายงาน</button>
                  {cOwn && editCommentId !== c.id && <button onClick={() => { setEditCommentText(c.body); setEditCommentId(c.id); }} className="text-[var(--muted)] hover:text-[var(--primary)]">แก้ไข</button>}
                  {cOwn && <button onClick={() => setDelComment(c.id)} className="text-red-600 hover:underline">ลบ</button>}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Add comment */}
      <section className="mt-4 rounded-lg bg-white p-3 shadow-sm">
        <textarea
          className="w-full resize-none rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          rows={2}
          maxLength={10000}
          placeholder="เขียนความคิดเห็น…"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        />
        {commentError && <p className="mt-1 text-sm text-red-600">{commentError}</p>}
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={() => addComment.mutate()} disabled={addComment.isPending || !commentText.trim()}>
            {addComment.isPending ? "กำลังส่ง…" : "ส่งความคิดเห็น"}
          </Button>
        </div>
      </section>

      {report && (
        <ReportDialog resourceType={report.type} resourceId={report.resourceId} open onOpenChange={(v) => { if (!v) setReport(null); }} />
      )}
      <ConfirmDialog
        open={!!delComment}
        onOpenChange={(o) => { if (!o) setDelComment(null); }}
        title="ลบความคิดเห็น"
        description="ต้องการลบความคิดเห็นนี้ใช่หรือไม่"
        confirmLabel="ลบ"
        onConfirm={() => { if (delComment) removeComment.mutate(delComment); }}
        loading={removeComment.isPending}
      />
    </div>
  );
}

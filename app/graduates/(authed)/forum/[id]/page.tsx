"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import PhotoAvatar from "@/components/forum/PhotoAvatar";
import ForumBody from "@/components/forum/ForumBody";
import ReportDialog from "@/components/forum/ReportDialog";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

const REPLY_PAGE_SIZE = 20;

const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface TopicDetail {
  id: string;
  authorId: string;
  title: string;
  body: string;
  replyCount: number;
  createdAt: string;
  author: AlumniPublicIdentity;
}
interface ReplyItem {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: AlumniPublicIdentity;
}

export default function TopicDetailPage() {
  const { id: topicId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  // Membership gives us the logged-in alumni id (for ownership UI) + opt-in.
  const { data: membership } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () => apiFetch<{ alumniId: string; optedIn: boolean }>("/api/alumni-profile/community-membership"),
  });
  const myId = membership?.alumniId;

  const [replyPage, setReplyPage] = useState(1);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);

  const [report, setReport] = useState<{ type: "FORUM_TOPIC" | "FORUM_REPLY"; resourceId: string } | null>(null);
  const [del, setDel] = useState<{ kind: "topic" | "reply"; id: string } | null>(null);

  const [editTopic, setEditTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState<{ title: string; body: string } | null>(null);
  const [editReplyId, setEditReplyId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const topicQ = useQuery({
    queryKey: queryKeys.forum.topic(topicId),
    queryFn: () => apiFetch<TopicDetail>(`/api/forum/topics/${topicId}`),
  });
  const topic = topicQ.data;

  const repliesQ = useQuery({
    queryKey: queryKeys.forum.replies(topicId, replyPage),
    queryFn: () =>
      apiFetch<{ data: ReplyItem[]; total: number; totalPages: number }>(
        `/api/forum/topics/${topicId}/replies?page=${replyPage}&pageSize=${REPLY_PAGE_SIZE}`,
      ),
  });
  const replies = repliesQ.data?.data ?? [];
  const replyTotalPages = repliesQ.data?.totalPages ?? 1;

  const createReply = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/forum/topics/${topicId}/replies`, { method: "POST", json: { body } }),
    onSuccess: () => {
      setReplyText("");
      setReplyError(null);
      qc.invalidateQueries({ queryKey: queryKeys.forum.replies(topicId, replyPage) });
      qc.invalidateQueries({ queryKey: queryKeys.forum.topic(topicId) });
      qc.invalidateQueries({ queryKey: queryKeys.forum.topics({ page: 1, search: "", sort: "newest" }) });
    },
    onError: (e) => setReplyError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  const removeTopic = useMutation({
    mutationFn: () => apiFetch(`/api/forum/topics/${topicId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.forum.all });
      router.push("/graduates/forum");
    },
    onError: (e) => setReplyError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  const removeReply = useMutation({
    mutationFn: (rid: string) => apiFetch(`/api/forum/replies/${rid}`, { method: "DELETE" }),
    onSuccess: () => {
      setDel(null);
      qc.invalidateQueries({ queryKey: queryKeys.forum.replies(topicId, replyPage) });
      qc.invalidateQueries({ queryKey: queryKeys.forum.topic(topicId) });
    },
    onError: (e) => setReplyError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  const saveTopic = useMutation({
    mutationFn: (payload: { title: string; body: string }) =>
      apiFetch(`/api/forum/topics/${topicId}`, { method: "PUT", json: payload }),
    onSuccess: () => {
      setEditTopic(false);
      setTopicDraft(null);
      qc.invalidateQueries({ queryKey: queryKeys.forum.topic(topicId) });
    },
    onError: (e) => setReplyError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  const saveReply = useMutation({
    mutationFn: ({ rid, body }: { rid: string; body: string }) =>
      apiFetch(`/api/forum/replies/${rid}`, { method: "PUT", json: { body } }),
    onSuccess: () => {
      setEditReplyId(null);
      qc.invalidateQueries({ queryKey: queryKeys.forum.replies(topicId, replyPage) });
    },
    onError: (e) => setReplyError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  if (topicQ.isPending) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }
  if (topicQ.isError || !topic) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-[var(--muted)]">
          {topicQ.error instanceof ApiError && topicQ.error.status === 404 ? "ไม่พบกระทู้" : "เกิดข้อผิดพลาดในการดึงข้อมูล"}
        </p>
        <Link href="/graduates/forum">
          <Button variant="outline" className="mt-4">กลับสู่กระดานสนทนา</Button>
        </Link>
      </div>
    );
  }

  const isTopicAuthor = !!myId && myId === topic.authorId;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/graduates/forum" className="text-sm text-[var(--muted)] hover:text-[var(--primary)]">
        ← กลับสู่กระดานสนทนา
      </Link>

      {/* Topic */}
      <article className="mt-4 rounded-lg bg-white p-6 shadow-sm">
        {editTopic ? (
          <div className="space-y-3">
            <input
              className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-lg font-semibold"
              value={topicDraft?.title ?? ""}
              onChange={(e) => setTopicDraft((d) => ({ title: e.target.value, body: d?.body ?? topic.body }))}
            />
            <textarea
              rows={10}
              maxLength={10000}
              className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
              value={topicDraft?.body ?? ""}
              onChange={(e) => setTopicDraft((d) => ({ title: d?.title ?? topic.title, body: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditTopic(false); setTopicDraft(null); }} disabled={saveTopic.isPending}>
                ยกเลิก
              </Button>
              <Button onClick={() => saveTopic.mutate(topicDraft ?? { title: topic.title, body: topic.body })} disabled={saveTopic.isPending}>
                {saveTopic.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mb-3 text-xl font-bold text-[var(--foreground)] sm:text-2xl">{topic.title}</h1>
            <div className="mb-4 flex items-center justify-between">
              <PhotoAvatar identity={topic.author} size="sm" />
              <span className="text-xs text-[var(--muted)]">{formatThaiDate(topic.createdAt)}</span>
            </div>
            <ForumBody text={topic.body} />
            <div className="mt-5 flex items-center gap-2 border-t border-[var(--border)] pt-3">
              <Button variant="ghost" size="sm" onClick={() => setReport({ type: "FORUM_TOPIC", resourceId: topic.id })}>
                รายงาน
              </Button>
              {isTopicAuthor && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => { setTopicDraft({ title: topic.title, body: topic.body }); setEditTopic(true); }}>
                    แก้ไข
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDel({ kind: "topic", id: topic.id })}>
                    ลบ
                  </Button>
                </>
              )}
              <span className="ml-auto text-xs text-[var(--muted)]">{topic.replyCount} ความคิดเห็น</span>
            </div>
          </>
        )}
      </article>

      {/* Replies */}
      <section className="mt-6 space-y-3">
        {repliesQ.isPending ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">กำลังโหลดความคิดเห็น…</p>
        ) : replies.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">ยังไม่มีความคิดเห็น เป็นคนแรกที่ตอบ</p>
        ) : (
          replies.map((r) => {
            const isReplyAuthor = !!myId && myId === r.authorId;
            return (
              <div key={r.id} className="rounded-lg bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <PhotoAvatar identity={r.author} size="sm" />
                  <span className="text-xs text-[var(--muted)]">{formatThaiDate(r.createdAt)}</span>
                </div>
                {editReplyId === r.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      maxLength={10000}
                      className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditReplyId(null)} disabled={saveReply.isPending}>ยกเลิก</Button>
                      <Button size="sm" onClick={() => saveReply.mutate({ rid: r.id, body: replyDraft.trim() })} disabled={saveReply.isPending}>
                        {saveReply.isPending ? "กำลังบันทึก..." : "บันทึก"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <ForumBody text={r.body} />
                    <div className="mt-3 flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setReport({ type: "FORUM_REPLY", resourceId: r.id })}>
                        รายงาน
                      </Button>
                      {isReplyAuthor && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setEditReplyId(r.id); setReplyDraft(r.body); }}>
                            แก้ไข
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDel({ kind: "reply", id: r.id })}>
                            ลบ
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}

        {/* Reply pagination */}
        {replyTotalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-2">
            <Button variant="outline" size="sm" disabled={replyPage === 1} onClick={() => setReplyPage((p) => Math.max(1, p - 1))}>
              ก่อนหน้า
            </Button>
            <span className="px-2 text-sm text-[var(--muted)]">หน้า {replyPage}/{replyTotalPages}</span>
            <Button variant="outline" size="sm" disabled={replyPage === replyTotalPages} onClick={() => setReplyPage((p) => p + 1)}>
              ถัดไป
            </Button>
          </div>
        )}
      </section>

      {/* Reply form */}
      <section className="mt-6 rounded-lg bg-white p-4 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">แสดงความคิดเห็น</label>
        <textarea
          rows={4}
          maxLength={10000}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          placeholder="เขียนความคิดเห็น…"
        />
        {replyError && <p className="mt-2 text-sm text-red-600">{replyError}</p>}
        <div className="mt-2 flex justify-end">
          <Button onClick={() => { if (replyText.trim()) createReply.mutate(replyText.trim()); }} disabled={createReply.isPending || !replyText.trim()}>
            {createReply.isPending ? "กำลังส่ง..." : "ส่งความคิดเห็น"}
          </Button>
        </div>
      </section>

      {/* Report dialog */}
      {report && (
        <ReportDialog
          resourceType={report.type}
          resourceId={report.resourceId}
          open={true}
          onOpenChange={(v) => { if (!v) setReport(null); }}
        />
      )}

      {/* Delete confirm */}
      {del && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-[var(--foreground)]">ยืนยันการลบ</h3>
            <p className="mb-4 text-sm text-[var(--muted)]">
              {del.kind === "topic" ? "การลบกระทู้จะลบความคิดเห็นทั้งหมดในกระทู้นี้ด้วย" : "ต้องการลบความคิดเห็นนี้ใช่หรือไม่"}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDel(null)}>ยกเลิก</Button>
              <Button
                variant="destructive"
                disabled={removeTopic.isPending || removeReply.isPending}
                onClick={() => (del.kind === "topic" ? removeTopic.mutate() : removeReply.mutate(del.id))}
              >
                ลบ
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import PhotoAvatar from "@/components/forum/PhotoAvatar";
import { formatEventDateThai } from "@/lib/event-format";
import { assetUrl } from "@/lib/asset-url";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

/**
 * One group's space (community V2): tabs "การสนทนา" (its ForumTopics — the
 * existing topic components/query with ?groupId=) and "กิจกรรม" (its events).
 */

interface GroupDetail {
  id: string;
  slug: string;
  kind: "COHORT" | "INTEREST";
  title: string;
  description: string;
  memberCount: number;
  topicCount: number;
}
interface TopicItem {
  id: string;
  title: string;
  body: string;
  replyCount: number;
  lastReplyAt: string | null;
  createdAt: string;
  author: AlumniPublicIdentity;
}
interface EventItem {
  id: string;
  title: string;
  startAt: string;
  location: string | null;
  onlineLink: string | null;
  coverImageUrl: string | null;
  headcount: number;
  capacity: number | null;
}
interface Paged<T> {
  data: T[];
  total: number;
  totalPages: number;
}

export default function GroupDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"topics" | "events">("topics");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [postError, setPostError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const { data: membership } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () => apiFetch<{ optedIn: boolean }>("/api/alumni-profile/community-membership"),
  });
  const optedIn = membership?.optedIn ?? false;

  const groupQ = useQuery({
    queryKey: queryKeys.groups.detail(slug),
    queryFn: () =>
      apiFetch<{ group: GroupDetail; isMember: boolean; myRole: string | null }>(
        `/api/groups/${encodeURIComponent(slug)}`,
      ),
  });
  const group = groupQ.data?.group;
  const isMember = groupQ.data?.isMember ?? false;

  const topicsQ = useQuery({
    queryKey: queryKeys.forum.topics({ page: 1, search: "", sort: "newest" }),
    queryFn: () =>
      apiFetch<Paged<TopicItem>>(
        `/api/forum/topics?groupId=${encodeURIComponent(group!.id)}&page=1&pageSize=10&sort=newest`,
      ),
    enabled: !!group,
  });

  const eventsQ = useQuery({
    queryKey: queryKeys.events.list({ page: 1, search: "", scope: "upcoming" }),
    queryFn: () =>
      apiFetch<Paged<EventItem>>(
        `/api/events?groupId=${encodeURIComponent(group!.id)}&scope=upcoming&page=1&pageSize=10`,
      ),
    enabled: !!group && tab === "events",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.forum.topics({ page: 1, search: "", sort: "newest" }) });
    qc.invalidateQueries({ queryKey: queryKeys.groups.all });
  };

  const createTopic = useMutation({
    mutationFn: () =>
      apiFetch("/api/forum/topics", {
        method: "POST",
        json: { title: newTitle.trim(), body: newBody.trim(), groupId: group!.id },
      }),
    onSuccess: () => {
      setNewTitle("");
      setNewBody("");
      setPostError(null);
      invalidate();
    },
    onError: (e) => setPostError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  const membership_ = useMutation({
    mutationFn: (action: "join" | "leave") =>
      apiFetch(`/api/groups/${encodeURIComponent(slug)}/membership`, {
        method: action === "join" ? "POST" : "DELETE",
      }),
    onSuccess: () => {
      setJoinError(null);
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
    onError: (e) => setJoinError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  if (groupQ.isPending) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (groupQ.isError || !group) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="mb-3 text-xl font-bold text-[var(--primary)]">ไม่พบกลุ่ม</h1>
          <Link href="/graduates/groups">
            <Button variant="outline">กลับหน้ากลุ่มศิษย์เก่า</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/graduates/groups" className="mb-4 inline-block text-sm text-[var(--primary)] hover:underline">
        ← กลุ่มศิษย์เก่า
      </Link>

      {/* Group header */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--primary)]">{group.title}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {group.kind === "COHORT" ? "กลุ่มรุ่น" : "กลุ่มความสนใจ"} · {group.memberCount} สมาชิก
            </p>
            {group.description && <p className="mt-2 text-sm">{group.description}</p>}
          </div>
          {optedIn && (
            isMember ? (
              <Button variant="outline" onClick={() => membership_.mutate("leave")} disabled={membership_.isPending}>
                ออกจากกลุ่ม
              </Button>
            ) : (
              <Button onClick={() => membership_.mutate("join")} disabled={membership_.isPending}>
                {membership_.isPending ? "กำลังเข้าร่วม..." : "เข้าร่วมกลุ่ม"}
              </Button>
            )
          )}
        </div>
        {joinError && <p className="mt-3 text-sm text-red-600">{joinError}</p>}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-[var(--border)]">
        {([["topics", `การสนทนา (${group.topicCount})`], ["events", "กิจกรรม"]] as const).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === key
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {tab === "topics" ? (
        <div className="space-y-4">
          {/* New topic (members only) */}
          {isMember && (
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={200}
                placeholder="ตั้งหัวข้อใหม่ในกลุ่มนี้..."
                className="mb-2 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              />
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={3}
                maxLength={10000}
                placeholder="เนื้อหา..."
                className="mb-2 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
              />
              {postError && <p className="mb-2 text-sm text-red-600">{postError}</p>}
              <div className="flex justify-end">
                <Button
                  onClick={() => createTopic.mutate()}
                  disabled={createTopic.isPending || newTitle.trim().length < 2 || newBody.trim().length < 1}
                >
                  {createTopic.isPending ? "กำลังโพสต์..." : "โพสต์ในกลุ่ม"}
                </Button>
              </div>
            </div>
          )}

          {topicsQ.isPending ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : (topicsQ.data?.data ?? []).length === 0 ? (
            <div className="rounded-lg bg-white py-12 text-center shadow-sm">
              <p className="text-sm text-[var(--muted)]">ยังไม่มีการสนทนาในกลุ่มนี้</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(topicsQ.data?.data ?? []).map((t) => (
                <Link
                  key={t.id}
                  href={`/graduates/forum/${t.id}`}
                  className="block rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-[var(--foreground)] hover:text-[var(--primary)]">
                      {t.title}
                    </h3>
                    <span className="shrink-0 text-xs text-[var(--muted)]">{t.replyCount} ความคิดเห็น</span>
                  </div>
                  <p className="mb-3 line-clamp-2 text-sm text-[var(--muted)]">{t.body}</p>
                  <PhotoAvatar identity={t.author} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {eventsQ.isPending ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : (eventsQ.data?.data ?? []).length === 0 ? (
            <div className="rounded-lg bg-white py-12 text-center shadow-sm">
              <p className="text-sm text-[var(--muted)]">ยังไม่มีกิจกรรมของกลุ่มนี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(eventsQ.data?.data ?? []).map((e) => (
                <Link
                  key={e.id}
                  href={`/graduates/events/${e.id}`}
                  className="overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {e.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assetUrl(e.coverImageUrl)} alt={`รูปปกกิจกรรม ${e.title ?? ""}`.trim()} className="h-32 w-full object-cover" />
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-[var(--foreground)]">{e.title}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      📅 {formatEventDateThai(e.startAt)}
                      {e.location && ` · 📍 ${e.location}`}
                    </p>
                    {e.capacity != null && (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {e.headcount}/{e.capacity} ที่นั่ง
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import SearchInput from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";

const GROUPS_PAGE_SIZE = 12;

interface Paged<T> {
  data: T[];
  total: number;
  totalPages: number;
}

interface GroupItem {
  id: string;
  slug: string;
  kind: "COHORT" | "INTEREST";
  title: string;
  description: string;
  memberCount: number;
  topicCount: number;
  isMember: boolean;
  myRole: "MEMBER" | "MODERATOR" | null;
}

export default function AlumniGroupsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Membership (opt-in gate) + the alum's own cohort (for the cohort join card).
  const { data: membership, isPending: membershipLoading } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () =>
      apiFetch<{ optedIn: boolean; cohort: string | null }>(
        "/api/alumni-profile/community-membership",
      ),
  });
  const optedIn = membership?.optedIn ?? false;
  const myCohort = membership?.cohort ?? null;

  const join = useMutation({
    mutationFn: (slug: string) =>
      apiFetch(`/api/groups/${encodeURIComponent(slug)}/membership`, { method: "POST" }),
    onSuccess: () => {
      setJoinError(null);
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
    onError: (e) => setJoinError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  const leave = useMutation({
    mutationFn: (slug: string) =>
      apiFetch(`/api/groups/${encodeURIComponent(slug)}/membership`, { method: "DELETE" }),
    onSuccess: () => {
      setJoinError(null);
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
    onError: (e) => setJoinError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/groups", {
        method: "POST",
        json: { title: createTitle.trim(), description: createDesc.trim() },
      }),
    onSuccess: () => {
      setShowCreate(false);
      setCreateTitle("");
      setCreateDesc("");
      setCreateError(null);
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
    onError: (e) => setCreateError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาดในการสร้างกลุ่ม"),
  });

  const { data: groupsData, isPending: loading, isError } = useQuery({
    queryKey: queryKeys.groups.list({ page: 1, search, kind: "" }),
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", pageSize: String(GROUPS_PAGE_SIZE) });
      if (search) params.set("search", search);
      return apiFetch<Paged<GroupItem>>(`/api/groups?${params}`);
    },
    enabled: optedIn,
  });

  const groups = groupsData?.data ?? [];
  const cohortGroups = groups.filter((g) => g.kind === "COHORT");
  const interestGroups = groups.filter((g) => g.kind === "INTEREST");
  const myCohortGroup = cohortGroups.find(
    (g) => myCohort && g.title === `รุ่น ${myCohort.replace(/\s+/g, " ").trim()}`,
  );

  function renderGroupCard(g: GroupItem) {
    return (
      <div key={g.id} className="flex flex-col rounded-lg bg-white p-4 shadow-sm">
        <Link href={`/graduates/groups/${g.slug}`} className="group">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
              {g.title}
            </h3>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-[var(--primary-dark)]">
              {g.kind === "COHORT" ? "กลุ่มรุ่น" : "กลุ่มความสนใจ"}
            </span>
          </div>
          <p className="mb-3 line-clamp-2 min-h-[2.5rem] text-sm text-[var(--muted)]">
            {g.description || "—"}
          </p>
        </Link>
        <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3">
          <span className="text-xs text-[var(--muted)]">
            {g.memberCount} สมาชิก · {g.topicCount} กระทู้
          </span>
          {g.isMember ? (
            <button
              onClick={() => leave.mutate(g.slug)}
              disabled={leave.isPending}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              ออกจากกลุ่ม
            </button>
          ) : (
            <Button
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => join.mutate(g.slug)}
              disabled={join.isPending}
            >
              เข้าร่วมกลุ่ม
            </Button>
          )}
        </div>
      </div>
    );
  }

  // --- Join card (not opted in) ---
  if (!membershipLoading && !optedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-white p-8 shadow-sm">
          <h1 className="mb-3 text-2xl font-bold text-[var(--primary)]">กลุ่มศิษย์เก่า</h1>
          <p className="mb-6 text-sm leading-relaxed text-[var(--muted)]">
            กลุ่มศิษย์เก่าเป็นพื้นที่สำหรับรุ่นและกลุ่มความสนใจต่าง ๆ ของสมาชิกชุมชนศิษย์เก่า
            กรุณาเข้าร่วมชุมชนก่อนใช้งาน
          </p>
          <Link href="/graduates/forum">
            <Button>เข้าร่วมชุมชน</Button>
          </Link>
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">กลุ่มศิษย์เก่า</h1>
        <Button onClick={() => setShowCreate(true)}>สร้างกลุ่มความสนใจ</Button>
      </div>

      {/* My-cohort quick join */}
      {myCohort && !myCohortGroup?.isMember && (
        <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-[var(--primary-dark)]">
            ท่านจบการศึกษารุ่น <strong>{myCohort}</strong> — เข้าร่วมกลุ่มรุ่นของท่านเพื่อติดตามข่าวสารและกิจกรรมของรุ่น
          </p>
          <Button onClick={() => join.mutate(`cohort:${myCohort}`)} disabled={join.isPending}>
            {join.isPending ? "กำลังเข้าร่วม..." : "เข้าร่วมกลุ่มรุ่นของฉัน"}
          </Button>
        </div>
      )}
      {joinError && <p className="mb-4 text-sm text-red-600">{joinError}</p>}

      {/* Search */}
      <div className="mb-6">
        <SearchInput
          value={search}
          onSearch={setSearch}
          placeholder="ค้นหากลุ่ม..."
          formClassName="w-full"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Cohort groups */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--primary-dark)]">กลุ่มรุ่น</h2>
            {cohortGroups.length === 0 ? (
              <p className="rounded-lg bg-white p-4 text-sm text-[var(--muted)] shadow-sm">
                ยังไม่มีกลุ่มรุ่น — กลุ่มรุ่นจะถูกสร้างอัตโนมัติเมื่อมีสมาชิกของรุ่นเข้าร่วม
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cohortGroups.map(renderGroupCard)}
              </div>
            )}
          </section>

          {/* Interest groups */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--primary-dark)]">กลุ่มความสนใจ</h2>
            {interestGroups.length === 0 ? (
              <p className="rounded-lg bg-white p-4 text-sm text-[var(--muted)] shadow-sm">
                ยังไม่มีกลุ่มความสนใจ — เป็นคนแรกที่สร้างกลุ่มได้เลย
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {interestGroups.map(renderGroupCard)}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Create-group dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">สร้างกลุ่มความสนใจ</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">ชื่อกลุ่ม</label>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  maxLength={120}
                  placeholder="เช่น พยาบาลผู้สูงอายุ ภาคเหนือ"
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">คำอธิบาย</label>
                <textarea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="คำอธิบายกลุ่มโดยย่อ"
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                />
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setShowCreate(false)} disabled={create.isPending}>
                  ยกเลิก
                </Button>
                <Button
                  onClick={() => create.mutate()}
                  disabled={create.isPending || createTitle.trim().length < 2}
                >
                  {create.isPending ? "กำลังสร้าง..." : "สร้างกลุ่ม"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

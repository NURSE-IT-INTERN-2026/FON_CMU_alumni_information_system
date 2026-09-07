"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import SearchInput from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import PhotoAvatar from "@/components/forum/PhotoAvatar";
import { THAI_PROVINCES } from "@/lib/thai-provinces";
import { DEGREE_LEVEL_OPTIONS } from "@/lib/constants";
import type { AlumniDirectoryIdentity } from "@/lib/forum-identity";

const DIRECTORY_PAGE_SIZE = 12;

interface Paged<T> {
  data: T[];
  total: number;
  totalPages: number;
}

export default function AlumniDirectoryPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [cohort, setCohort] = useState("");
  const [degreeLevel, setDegreeLevel] = useState("");
  const [province, setProvince] = useState("");
  const [country, setCountry] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  // Membership (opt-in state) — the directory follows the forum gate.
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
      qc.invalidateQueries({ queryKey: queryKeys.forum.all });
    },
    onError: (e) => {
      setJoinError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
    },
  });

  const { data: directoryData, isPending: loading, isError } = useQuery({
    queryKey: queryKeys.community.directory({ page, search, cohort, degreeLevel, province, country }),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(DIRECTORY_PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (cohort) params.set("cohort", cohort);
      if (degreeLevel) params.set("degreeLevel", degreeLevel);
      if (province) params.set("province", province);
      if (country) params.set("country", country);
      return apiFetch<Paged<AlumniDirectoryIdentity>>(`/api/directory?${params}`);
    },
    enabled: optedIn,
  });

  const members = directoryData?.data ?? [];
  const total = directoryData?.total ?? 0;
  const totalPages = directoryData?.totalPages ?? 1;

  // --- Join card (not opted in) ---
  if (!membershipLoading && !optedIn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-white p-8 shadow-sm" data-tour="directory-join-card">
          <h1 className="mb-3 text-2xl font-bold text-[var(--primary)]" data-tour="directory-heading">ไดเรกทอรีศิษย์เก่า</h1>
          <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
            ไดเรกทอรีศิษย์เก่าเป็นทะเบียนสมาชิกชุมชนศิษย์เก่าที่เข้าร่วมโดยสมัครใจ
            การเข้าร่วมเป็นการให้ความยินยอมให้ศิษย์เก่าท่านอื่นที่เข้าร่วมค้นหาและเห็นข้อมูลของท่าน
            (คำนำหน้า ชื่อ นามสกุล รุ่น ระดับปริญญา รูปประจำตัว และข้อมูลโปรไฟล์ชุมชนที่ท่านกรอก)
          </p>
          <p className="mb-6 text-sm leading-relaxed text-[var(--muted)]">
            ท่านสามารถยกเลิกการเข้าร่วมได้ทุกเมื่อ และสามารถเลือกเผยแพร่เฉพาะข้อมูลที่ท่านต้องการในหน้าโปรไฟล์ชุมชน
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl" data-tour="directory-heading">ไดเรกทอรีศิษย์เก่า</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ค้นหาเพื่อนศิษย์เก่าสมาชิกชุมชน {total > 0 && `(${total} สมาชิก)`}
        </p>
      </div>

      {/* Search + filters */}
      <div className="mb-6 space-y-3" data-tour="directory-search">
        <SearchInput
          value={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          placeholder="ค้นหาชื่อ สถานที่ทำงาน หรือตำแหน่ง..."
          formClassName="w-full"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            list="directory-provinces"
            value={province}
            onChange={(e) => { setProvince(e.target.value); setPage(1); }}
            placeholder="จังหวัด"
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          />
          <datalist id="directory-provinces">
            {THAI_PROVINCES.map((p) => <option key={p} value={p} />)}
          </datalist>
          <input
            value={country}
            onChange={(e) => { setCountry(e.target.value); setPage(1); }}
            placeholder="ประเทศ"
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          />
          <select
            value={degreeLevel}
            onChange={(e) => { setDegreeLevel(e.target.value); setPage(1); }}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          >
            <option value="">ทุกระดับปริญญา</option>
            {DEGREE_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            value={cohort}
            onChange={(e) => { setCohort(e.target.value); setPage(1); }}
            placeholder="รุ่น (เช่น พยบ. 25)"
            className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Member grid */}
      {loading ? (
        <div className="flex justify-center py-16" data-tour="directory-grid">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm" data-tour="directory-grid">
          <p className="text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</p>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm" data-tour="directory-grid">
          <p className="text-[var(--muted)]">ไม่พบสมาชิกที่ตรงกับการค้นหา</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-tour="directory-grid">
          {members.map((m) => (
            <Link
              key={m.id}
              href={`/graduates/directory/${m.id}`}
              className="block rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <PhotoAvatar
                identity={{ ...m, photoUrl: m.communityProfile?.photoUrl ?? m.photoUrl }}
                size="md"
              />
              {(m.communityProfile?.currentWorkplace || m.communityProfile?.province || m.communityProfile?.country) && (
                <div className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                  {m.communityProfile?.currentWorkplace && (
                    <p className="truncate">💼 {m.communityProfile.currentWorkplace}</p>
                  )}
                  {(m.communityProfile?.province || m.communityProfile?.country) && (
                    <p className="mt-1 truncate">
                      📍 {[m.communityProfile?.province, m.communityProfile?.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
          >
            ก่อนหน้า
          </button>
          <span className="text-sm text-[var(--muted)]">หน้า {page} / {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
}

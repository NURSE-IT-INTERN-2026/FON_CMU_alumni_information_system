"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { assetUrl } from "@/lib/asset-url";
import SearchInput from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import EventOrganizerView, { type EventOrganizer } from "@/components/events/EventOrganizer";
import EventCalendarView from "@/components/events/EventCalendarView";
import { formatEventDateThai } from "@/lib/event-format";
import {
  currentBangkokMonth,
  monthRangeBangkok,
  shiftMonth,
  type MonthCursor,
} from "@/lib/event-calendar";

const PAGE_SIZE = 9;

interface EventItem {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  onlineLink: string | null;
  coverImageUrl: string | null;
  capacity: number | null;
  guestLimit: number;
  organizer: EventOrganizer;
  headcount: number;
  isFull: boolean;
}
interface Paged<T> { data: T[]; total: number; totalPages: number; }

export default function AlumniEventsPage() {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [cursor, setCursor] = useState<MonthCursor>(currentBangkokMonth);

  // optedIn drives the "จัดกิจกรรม" button (only opted-in alumni may create).
  const { data: membership } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () => apiFetch<{ optedIn: boolean }>("/api/alumni-profile/community-membership"),
  });
  const optedIn = membership?.optedIn ?? false;

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.events.list({ page, search, scope }),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), scope });
      if (search) params.set("search", search);
      return apiFetch<Paged<EventItem>>(`/api/events?${params}`);
    },
    enabled: view === "list",
  });
  const events = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Calendar month query: ?from=&to= Bangkok month window + search. pageSize
  // is server-capped at 100 — loop the (absurd) >100-events/month case only.
  const { data: calEvents, isPending: calPending } = useQuery({
    queryKey: queryKeys.events.month({ ...cursor, search }),
    queryFn: async () => {
      const range = monthRangeBangkok(cursor);
      const out: EventItem[] = [];
      let pageNum = 1;
      for (;;) {
        const params = new URLSearchParams({
          page: String(pageNum),
          pageSize: "100",
          from: range.from,
          to: range.to,
        });
        if (search) params.set("search", search);
        const res = await apiFetch<Paged<EventItem>>(`/api/events?${params}`);
        out.push(...res.data);
        if (out.length >= res.total || res.data.length === 0) return out;
        pageNum++;
      }
    },
    enabled: view === "calendar",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl" data-tour="events-heading">กิจกรรมและการพบปะ</h1>
        {optedIn ? (
          <Link href="/graduates/events/new" data-tour="events-create">
            <Button>จัดกิจกรรม</Button>
          </Link>
        ) : (
          <span className="text-xs text-[var(--muted)]">เข้าร่วมชุมชนศิษย์เก่าเพื่อจัดกิจกรรม</span>
        )}
      </div>

      {/* Tabs + view toggle */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        {view === "list" ? (
          <div className="flex gap-2" data-tour="events-scope-tabs">
            {(["upcoming", "past"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setScope(s); setPage(1); }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  scope === s ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"
                }`}
              >
                {s === "upcoming" ? "กำลังจะมาถึง" : "ที่ผ่านมา"}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[var(--muted)]">แสดงกิจกรรมรายเดือน</span>
        )}
        <div className="flex gap-2" role="group" aria-label="มุมมองการแสดงผล" data-tour="events-view-toggle">
          {(["list", "calendar"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                view === v ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"
              }`}
            >
              {v === "list" ? "รายการ" : "ปฏิทิน"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6" data-tour="events-search">
        <SearchInput
          value={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          placeholder="ค้นหากิจกรรม..."
        />
      </div>

      {view === "calendar" ? (
        <EventCalendarView
          events={calEvents ?? []}
          cursor={cursor}
          isPending={calPending}
          onPrev={() => setCursor((c) => shiftMonth(c, -1))}
          onNext={() => setCursor((c) => shiftMonth(c, 1))}
          onToday={() => setCursor(currentBangkokMonth())}
        />
      ) : (
        <>
      {isPending ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</p>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm" data-tour="events-grid">
          <p className="text-[var(--muted)]">{scope === "upcoming" ? "ยังไม่มีกิจกรรมที่กำลังจะมาถึง" : "ยังไม่มีกิจกรรมที่ผ่านมา"}</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-tour="events-grid">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/graduates/events/${e.id}`}
              className="group overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="aspect-video w-full overflow-hidden bg-gray-100">
                {e.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(e.coverImageUrl)} alt={e.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[var(--primary)]/5">
                    <svg className="h-12 w-12 text-[var(--primary)]/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V11.25a2.25 2.25 0 0 1 2.25-2.25h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="mb-1 line-clamp-2 break-words text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">{e.title}</h3>
                <p className="mb-3 text-xs font-medium text-[var(--primary)]">{formatEventDateThai(e.startAt)}</p>
                <p className="mb-3 line-clamp-1 break-words text-sm text-[var(--muted)]">{e.location || (e.onlineLink ? "ออนไลน์" : "—")}</p>
                <div className="flex items-center justify-between">
                  <EventOrganizerView organizer={e.organizer} />
                  <span className={`shrink-0 text-xs ${e.isFull ? "text-red-600" : "text-[var(--muted)]"}`}>
                    {e.isFull ? "เต็มแล้ว" : `${e.headcount} เข้าร่วม`}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1.5">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button>
          <span className="px-2 text-sm text-[var(--muted)]">หน้า {page}/{totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button>
        </div>
      )}
        </>
      )}
    </div>
  );
}

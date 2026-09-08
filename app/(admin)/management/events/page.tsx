"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useCanWrite } from "@/lib/role-context";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import EventFormDialog, { type EventFormValues } from "@/components/events/EventFormDialog";
import EventCard from "@/components/events/EventCard";
import { type EventOrganizer } from "@/components/events/EventOrganizer";
import { isoToDatetimeLocal } from "@/lib/event-format";

interface AdminEvent {
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

function toFormValues(e: AdminEvent): EventFormValues {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    startAt: isoToDatetimeLocal(e.startAt),
    endAt: isoToDatetimeLocal(e.endAt),
    location: e.location ?? "",
    onlineLink: e.onlineLink ?? "",
    capacity: e.capacity != null ? String(e.capacity) : "",
    guestLimit: String(e.guestLimit),
    coverImageUrl: e.coverImageUrl ?? "",
  };
}

export default function AdminEventsPage() {
  const canWrite = useCanWrite();
  const qc = useQueryClient();
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EventFormValues | null>(null);
  const [deleting, setDeleting] = useState<AdminEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.events.list({ page, search: "", scope }),
    queryFn: () =>
      apiFetch<Paged<AdminEvent>>(`/api/events?scope=${scope}&page=${page}&pageSize=20`),
  });
  const events = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const bust = () => qc.invalidateQueries({ queryKey: queryKeys.events.all });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/events/${id}`, { method: "DELETE" }),
    onSuccess: () => { setDeleting(null); bust(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl" data-tour="admin-events-heading">กิจกรรม</h1>
        {canWrite && <span data-tour="admin-events-create"><Button onClick={() => setCreateOpen(true)}>สร้างกิจกรรม</Button></span>}
      </div>

      <div className="mb-5 flex gap-2" data-tour="admin-events-scope-tabs">
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

      {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

      {isPending ? (
        <div className="flex justify-center py-16" data-tour="admin-events-list">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm" data-tour="admin-events-list">
          <p className="text-[var(--muted)]">ยังไม่มีกิจกรรม</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-tour="admin-events-list">
          {events.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              footer={
                canWrite ? (
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(toFormValues(e))}>แก้ไข</Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleting(e)}>ลบ</Button>
                  </div>
                ) : undefined
              }
            />
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

      {createOpen && (
        <EventFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={bust} />
      )}
      {editing && (
        <EventFormDialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }} initial={editing} onSaved={bust} />
      )}

      {deleting && (
        <Modal
          open
          onOpenChange={(o) => { if (!o) setDeleting(null); }}
          title="ลบกิจกรรม"
          size="sm"
          showCloseButton={false}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleting(null)}>ยกเลิก</Button>
              <Button variant="destructive" disabled={del.isPending} onClick={() => del.mutate(deleting.id)}>ลบ</Button>
            </>
          }
        >
          <p className="text-sm text-[var(--muted)]">ต้องการลบ &ldquo;{deleting.title}&rdquo; ใช่หรือไม่ (กู้คืนได้จากถังขยะ)</p>
        </Modal>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { assetUrl } from "@/lib/asset-url";
import { BASE_PATH } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import PhotoAvatar from "@/components/forum/PhotoAvatar";
import ForumBody from "@/components/forum/ForumBody";
import ReportDialog from "@/components/forum/ReportDialog";
import EventOrganizerView, { type EventOrganizer } from "@/components/events/EventOrganizer";
import EventPhotoAlbum from "@/components/events/EventPhotoAlbum";
import { formatEventDateTimeThai } from "@/lib/event-format";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

interface Attendee { guestCount: number; alumni: AlumniPublicIdentity; }
interface EventDetail {
  id: string;
  organizerAlumniId: string | null;
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
  attendees: Attendee[];
  headcount: number;
  isFull: boolean;
  myRsvp: { status: "ATTENDING" | "DECLINED"; guestCount: number } | null;
}

export default function EventDetailPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: membership } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () => apiFetch<{ alumniId: string }>("/api/alumni-profile/community-membership"),
  });
  const myId = membership?.alumniId;

  const { data: ev, isPending, isError, error } = useQuery({
    queryKey: queryKeys.events.detail(eventId),
    queryFn: () => apiFetch<EventDetail>(`/api/events/${eventId}`),
  });

  const [guests, setGuests] = useState(0);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const bust = () => {
    qc.invalidateQueries({ queryKey: queryKeys.events.detail(eventId) });
    qc.invalidateQueries({ queryKey: queryKeys.events.all });
  };

  const rsvpMut = useMutation({
    mutationFn: (payload: { status: "ATTENDING" | "DECLINED"; guestCount?: number }) =>
      apiFetch(`/api/events/${eventId}/rsvp`, { method: "POST", json: payload }),
    onSuccess: bust,
    onError: (e) => setRsvpError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });
  const cancelRsvp = useMutation({
    mutationFn: () => apiFetch(`/api/events/${eventId}/rsvp`, { method: "DELETE" }),
    onSuccess: bust,
  });
  const deleteEvent = useMutation({
    mutationFn: () => apiFetch(`/api/events/${eventId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.events.all }); router.push("/graduates/events"); },
    onError: (e) => setRsvpError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  // Cover management (organizer-only UI; the PUT route enforces organizer-or-staff).
  // Bytes go through /api/alumni-upload, then the URL is PUT onto the event —
  // a null file means "remove" (the route normalizes "" to null).
  async function saveCover(file: File | null) {
    setCoverBusy(true);
    setCoverError(null);
    try {
      let url = "";
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${BASE_PATH}/api/alumni-upload`, { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "อัปโหลดไม่สำเร็จ");
        }
        ({ url } = await res.json());
      }
      await apiFetch(`/api/events/${eventId}`, { method: "PUT", json: { coverImageUrl: url } });
      bust();
    } catch (e) {
      setCoverError(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setCoverBusy(false);
    }
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }
  if (isError || !ev) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-[var(--muted)]">{error instanceof ApiError && error.status === 404 ? "ไม่พบกิจกรรม" : "เกิดข้อผิดพลาดในการดึงข้อมูล"}</p>
        <Link href="/graduates/events"><Button variant="outline" className="mt-4">กลับสู่กิจกรรม</Button></Link>
      </div>
    );
  }

  const amOrganizer = ev.organizer?.type === "alumni" && ev.organizer.id === myId;
  const amAttending = ev.myRsvp?.status === "ATTENDING";
  const canAttend = !ev.isFull || amAttending;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/graduates/events" className="text-sm text-[var(--muted)] hover:text-[var(--primary)]">← กลับสู่กิจกรรม</Link>

      <article className="mt-4 overflow-hidden rounded-lg bg-white shadow-sm">
        {(ev.coverImageUrl || amOrganizer) && (
          <div className="relative aspect-[2/1] w-full overflow-hidden bg-gray-100">
            {ev.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(ev.coverImageUrl)} alt={ev.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-[var(--primary)]/5">
                <svg className="h-12 w-12 text-[var(--primary)]/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V11.25a2.25 2.25 0 0 1 2.25-2.25h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5" />
                </svg>
              </div>
            )}
            {amOrganizer && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {ev.coverImageUrl && (
                  <button
                    type="button"
                    disabled={coverBusy}
                    onClick={() => void saveCover(null)}
                    className="rounded-md bg-white/90 px-2.5 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-white disabled:opacity-50"
                  >
                    ลบรูปปก
                  </button>
                )}
                <label className="cursor-pointer rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-[var(--primary-dark)] shadow-sm hover:bg-white">
                  {coverBusy ? "กำลังอัปโหลด..." : ev.coverImageUrl ? "เปลี่ยนรูปปก" : "อัปโหลดรูปปก"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    disabled={coverBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void saveCover(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        )}
        {coverError && <p className="px-6 pt-4 text-sm text-red-600">{coverError}</p>}
        <div className="p-6">
          <h1 className="mb-2 break-words text-2xl font-bold text-[var(--foreground)]" data-tour="events-detail-title">{ev.title}</h1>
          <p className="mb-1 text-sm font-medium text-[var(--primary)]">{formatEventDateTimeThai(ev.startAt)}</p>
          {ev.endAt && <p className="mb-3 text-xs text-[var(--muted)]">ถึง {formatEventDateTimeThai(ev.endAt)}</p>}

          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--foreground)]" data-tour="events-detail-info">
            {ev.location && <span className="break-words">📍 {ev.location}</span>}
            {ev.onlineLink && (
              <a href={ev.onlineLink} target="_blank" rel="nofollow noopener noreferrer" className="text-[var(--primary)] hover:underline">🔗 ลิงก์ออนไลน์</a>
            )}
          </div>

          <ForumBody text={ev.description} />

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
            <EventOrganizerView organizer={ev.organizer} />
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>รายงาน</Button>
              {amOrganizer && (
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmDelete(true)}>ลบ</Button>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* RSVP + capacity */}
      <section className="mt-6 rounded-lg bg-white p-5 shadow-sm" data-tour="events-detail-rsvp">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">การเข้าร่วม</h2>
          <span className={`text-sm ${ev.isFull ? "text-red-600" : "text-[var(--muted)]"}`}>
            {ev.headcount}{ev.capacity ? `/${ev.capacity}` : ""} ท่าน {ev.isFull && "(เต็มแล้ว)"}
          </span>
        </div>

        {rsvpError && <p className="mb-3 text-sm text-red-600">{rsvpError}</p>}

        {amAttending ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-600">✓ คุณเข้าร่วมกิจกรรมนี้</p>
            {ev.guestLimit > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--muted)]">ผู้ร่วมเดินทาง (สูงสุด {ev.guestLimit})</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={rsvpMut.isPending} onClick={() => { const g = Math.max(0, (ev.myRsvp?.guestCount ?? 0) - 1); rsvpMut.mutate({ status: "ATTENDING", guestCount: g }); }}>−</Button>
                  <span className="w-8 text-center">{ev.myRsvp?.guestCount ?? 0}</span>
                  <Button size="sm" variant="outline" disabled={rsvpMut.isPending || (ev.myRsvp?.guestCount ?? 0) >= ev.guestLimit} onClick={() => { const g = Math.min(ev.guestLimit, (ev.myRsvp?.guestCount ?? 0) + 1); rsvpMut.mutate({ status: "ATTENDING", guestCount: g }); }}>+</Button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={cancelRsvp.isPending} onClick={() => cancelRsvp.mutate()}>ยกเลิกการเข้าร่วม</Button>
              <Button variant="ghost" size="sm" disabled={rsvpMut.isPending} onClick={() => rsvpMut.mutate({ status: "DECLINED" })}>ไม่เข้าร่วม</Button>
            </div>
          </div>
        ) : ev.myRsvp?.status === "DECLINED" ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">คุณแจ้งไม่เข้าร่วม</p>
            <Button size="sm" disabled={!canAttend || rsvpMut.isPending} onClick={() => rsvpMut.mutate({ status: "ATTENDING", guestCount: 0 })}>
              {ev.isFull ? "เต็มแล้ว" : "เข้าร่วม"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {ev.guestLimit > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--muted)]">ผู้ร่วมเดินทาง</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setGuests((g) => Math.max(0, g - 1))}>−</Button>
                  <span className="w-8 text-center">{guests}</span>
                  <Button size="sm" variant="outline" disabled={guests >= ev.guestLimit} onClick={() => setGuests((g) => Math.min(ev.guestLimit, g + 1))}>+</Button>
                </div>
              </div>
            )}
            <Button disabled={!canAttend || rsvpMut.isPending} onClick={() => rsvpMut.mutate({ status: "ATTENDING", guestCount: guests })}>
              {rsvpMut.isPending ? "กำลังบันทึก..." : ev.isFull ? "เต็มแล้ว" : "เข้าร่วม"}
            </Button>
          </div>
        )}
      </section>

      {/* Attendees */}
      {ev.attendees.length > 0 && (
        <section className="mt-6 rounded-lg bg-white p-5 shadow-sm" data-tour="events-detail-attendees">
          <h2 className="mb-3 text-sm font-semibold">ผู้เข้าร่วม ({ev.headcount})</h2>
          <ul className="space-y-2">
            {ev.attendees.map((a) => (
              <li key={a.alumni.id} className="flex items-center justify-between">
                <PhotoAvatar identity={a.alumni} size="sm" />
                {a.guestCount > 0 && <span className="text-xs text-[var(--muted)]">+{a.guestCount} ผู้ร่วมเดินทาง</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Photo album (community V2) */}
      <div className="mt-6" data-tour="events-detail-album">
        <EventPhotoAlbum eventId={ev.id} />
      </div>

      {reportOpen && (
        <ReportDialog resourceType="EVENT" resourceId={ev.id} open={reportOpen} onOpenChange={setReportOpen} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => { if (!o) setConfirmDelete(false); }}
        title="ลบกิจกรรม"
        description="การลบกิจกรรมจะลบการลงทะเบียนทั้งหมดด้วย ไม่สามารถย้อนกลับได้ (ผู้ดูแลสามารถกู้คืนจากถังขยะได้)"
        confirmLabel="ลบกิจกรรม"
        onConfirm={() => deleteEvent.mutate()}
        loading={deleteEvent.isPending}
      />
    </div>
  );
}

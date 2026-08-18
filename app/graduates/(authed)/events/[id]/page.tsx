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
        {ev.coverImageUrl && (
          <div className="aspect-[2/1] w-full overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl(ev.coverImageUrl)} alt={ev.title} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">{ev.title}</h1>
          <p className="mb-1 text-sm font-medium text-[var(--primary)]">{formatEventDateTimeThai(ev.startAt)}</p>
          {ev.endAt && <p className="mb-3 text-xs text-[var(--muted)]">ถึง {formatEventDateTimeThai(ev.endAt)}</p>}

          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--foreground)]">
            {ev.location && <span>📍 {ev.location}</span>}
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
      <section className="mt-6 rounded-lg bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">การเข้าร่วน</h2>
          <span className={`text-sm ${ev.isFull ? "text-red-600" : "text-[var(--muted)]"}`}>
            {ev.headcount}{ev.capacity ? `/${ev.capacity}` : ""} ท่าน {ev.isFull && "(เต็มแล้ว)"}
          </span>
        </div>

        {rsvpError && <p className="mb-3 text-sm text-red-600">{rsvpError}</p>}

        {amAttending ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-600">✓ คุณเข้าร่วนกิจกรรมนี้</p>
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
              <Button variant="outline" size="sm" disabled={cancelRsvp.isPending} onClick={() => cancelRsvp.mutate()}>ยกเลิกการเข้าร่วน</Button>
              <Button variant="ghost" size="sm" disabled={rsvpMut.isPending} onClick={() => rsvpMut.mutate({ status: "DECLINED" })}>ไม่เข้าร่วน</Button>
            </div>
          </div>
        ) : ev.myRsvp?.status === "DECLINED" ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">คุณแจ้งไม่เข้าร่วน</p>
            <Button size="sm" disabled={!canAttend || rsvpMut.isPending} onClick={() => rsvpMut.mutate({ status: "ATTENDING", guestCount: 0 })}>
              {ev.isFull ? "เต็มแล้ว" : "เข้าร่วน"}
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
              {rsvpMut.isPending ? "กำลังบันทึก..." : ev.isFull ? "เต็มแล้ว" : "เข้าร่วน"}
            </Button>
          </div>
        )}
      </section>

      {/* Attendees */}
      {ev.attendees.length > 0 && (
        <section className="mt-6 rounded-lg bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">ผู้เข้าร่วน ({ev.headcount})</h2>
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
      <div className="mt-6">
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

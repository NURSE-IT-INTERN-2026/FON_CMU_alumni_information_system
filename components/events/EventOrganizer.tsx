"use client";

import PhotoAvatar from "@/components/forum/PhotoAvatar";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

export type EventOrganizer =
  | ({ type: "alumni" } & AlumniPublicIdentity)
  | { type: "staff"; id: string; name: string }
  | null;

/** Renders an event's organizer: alumni organizers via PhotoAvatar, staff via a badge. */
export default function EventOrganizerView({ organizer }: { organizer: EventOrganizer }) {
  if (!organizer) return <span className="text-xs text-[var(--muted)]">ผู้จัดถูกลบแล้ว</span>;
  if (organizer.type === "alumni") return <PhotoAvatar identity={organizer} size="sm" />;
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-semibold text-white">
        เจ้า
      </span>
      <div className="leading-tight">
        <p className="text-sm font-medium text-[var(--foreground)]">เจ้าหน้าที่</p>
        <p className="text-xs text-[var(--muted)]">{organizer.name}</p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { assetUrl } from "@/lib/asset-url";
import EventOrganizerView, { type EventOrganizer } from "@/components/events/EventOrganizer";
import { formatEventDateThai } from "@/lib/event-format";

/** The fields the card renders — a subset of the events API row. */
export interface EventCardData {
  id: string;
  title: string;
  startAt: string;
  location: string | null;
  onlineLink: string | null;
  coverImageUrl: string | null;
  organizer: EventOrganizer;
  headcount: number;
  isFull: boolean;
}

const CARD_CLASS =
  "group overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md";

/**
 * The event card shared by the alumni events grid and the admin management
 * page, so both render identical visuals. `href` wraps the card in a Link
 * (alumni detail navigation); without it the card is static (admin has no
 * detail page) and `footer` carries the admin action row instead.
 */
export default function EventCard({
  event: e,
  href,
  footer,
}: {
  event: EventCardData;
  href?: string;
  footer?: ReactNode;
}) {
  const body = (
    <>
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
        {footer && <div className="mt-3 border-t border-[var(--border)] pt-3">{footer}</div>}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={CARD_CLASS}>
        {body}
      </Link>
    );
  }
  return <div className={CARD_CLASS}>{body}</div>;
}

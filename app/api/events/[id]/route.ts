import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import {
  resolveEventReader,
  resolveEventStaffOrAlumni,
  adminLogCtx,
  alumniLogCtx,
} from "@/lib/event-guard";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { bangkokDatetimeLocalToIso } from "@/lib/event-format";
import { handleZodError, eventUpdateSchema } from "@/lib/validations";

const ORGANIZER_INCLUDE = {
  organizerAlumni: { select: SELECT_ALUMNI_PUBLIC_IDENTITY },
  organizerUser: { select: { id: true, firstName: true, lastName: true } },
  group: { select: { id: true, slug: true, title: true } },
} as const;

function shapeOrganizer(ev: {
  organizerAlumni?: { id: string; prefix: string; firstName: string; lastName: string; cohort: string | null; degreeLevel: string; photoUrl: string | null } | null;
  organizerUser?: { id: string; firstName: string; lastName: string } | null;
}) {
  if (ev.organizerAlumni) return { type: "alumni" as const, ...ev.organizerAlumni };
  if (ev.organizerUser) return { type: "staff" as const, id: ev.organizerUser.id, name: `${ev.organizerUser.firstName} ${ev.organizerUser.lastName}`.trim() };
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveEventReader();
    if ("error" in reader) return reader.error;
    const { id } = await params;

    const event = await prisma.communityEvent.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...ORGANIZER_INCLUDE,
        rsvps: {
          where: { status: "ATTENDING" },
          include: { alumni: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!event) return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });

    const headcount = event.rsvps.length + event.rsvps.reduce((s, r) => s + r.guestCount, 0);
    const attendees = event.rsvps.map((r) => ({ guestCount: r.guestCount, alumni: r.alumni }));

    // The requesting alum's own RSVP (any status), if they're signed in as alumni.
    let myRsvp: { status: string; guestCount: number } | null = null;
    if (reader.alumni) {
      const mine = await prisma.eventRsvp.findUnique({
        where: { eventId_alumniId: { eventId: id, alumniId: reader.alumni.id } },
        select: { status: true, guestCount: true },
      });
      myRsvp = mine ? { status: mine.status, guestCount: mine.guestCount } : null;
    }

    return NextResponse.json({
      ...event,
      organizer: shapeOrganizer(event),
      attendees,
      headcount,
      isFull: event.capacity != null && headcount >= event.capacity,
      myRsvp,
    });
  } catch (error) {
    console.error("GET /api/events/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const who = await resolveEventStaffOrAlumni();
    if ("error" in who) return who.error;
    const { id } = await params;

    const existing = await prisma.communityEvent.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });

    // Staff (with write perm) may edit any event; an alum may edit only their own.
    if (who.staff) {
      const permErr = await checkWritePermission();
      if (permErr) return permErr;
    } else if (existing.organizerAlumniId !== who.alumni!.id) {
      return NextResponse.json({ error: "คุณไม่สามารถแก้ไขกิจกรรมของผู้อื่นได้" }, { status: 403 });
    }

    const v = eventUpdateSchema.parse(await request.json());
    const data: Record<string, unknown> = {};
    if (v.title !== undefined) data.title = v.title;
    if (v.description !== undefined) data.description = v.description;
    if (v.startAt !== undefined) data.startAt = new Date(bangkokDatetimeLocalToIso(v.startAt));
    if (v.endAt !== undefined) data.endAt = v.endAt ? new Date(bangkokDatetimeLocalToIso(v.endAt)) : null;
    if (v.location !== undefined) data.location = v.location?.trim() || null;
    if (v.onlineLink !== undefined) data.onlineLink = v.onlineLink?.trim() || null;
    if (v.capacity !== undefined) data.capacity = v.capacity ?? null;
    if (v.guestLimit !== undefined) data.guestLimit = v.guestLimit;
    if (v.coverImageUrl !== undefined) data.coverImageUrl = v.coverImageUrl || null;

    const event = await prisma.communityEvent.update({ where: { id }, data, include: ORGANIZER_INCLUDE });
    const actor = who.staff ? adminLogCtx(who.staff) : alumniLogCtx(who.alumni!);
    await logActivity(actor, "UPDATE", "community_event", id, { title: event.title });
    return NextResponse.json({ ...event, organizer: shapeOrganizer(event) });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/events/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึก" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const who = await resolveEventStaffOrAlumni();
    if ("error" in who) return who.error;
    const { id } = await params;

    const existing = await prisma.communityEvent.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });

    if (who.staff) {
      const permErr = await checkWritePermission();
      if (permErr) return permErr;
    } else if (existing.organizerAlumniId !== who.alumni!.id) {
      return NextResponse.json({ error: "คุณไม่สามารถลบกิจกรรมของผู้อื่นได้" }, { status: 403 });
    }

    await prisma.communityEvent.update({ where: { id }, data: { deletedAt: new Date() } });
    const actor = who.staff ? adminLogCtx(who.staff) : alumniLogCtx(who.alumni!);
    await logActivity(actor, "DELETE", "community_event", id, { title: existing.title });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/events/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { resolveEventReader, alumniLogCtx } from "@/lib/event-guard";
import { rsvpSeats, fitsCapacity } from "@/lib/event-capacity";
import { handleZodError, rsvpSchema } from "@/lib/validations";
import { emitNotification } from "@/lib/notification-emitter";

// RSVP is an alumni action. Any ACTIVE alum may RSVP (events are a broadcast);
// staff (no alumni identity) get a 403.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveEventReader();
    if ("error" in reader) return reader.error;
    if (!reader.alumni) {
      return NextResponse.json({ error: "การลงทะเบียนเป็นฟังก์ชันของศิษย์เก่า" }, { status: 403 });
    }
    const alumni = reader.alumni;
    const { id: eventId } = await params;

    const event = await prisma.communityEvent.findFirst({ where: { id: eventId, deletedAt: null } });
    if (!event) return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });

    const v = rsvpSchema.parse(await request.json());
    const guestCount = v.guestCount ?? 0;
    if (guestCount > event.guestLimit) {
      return NextResponse.json(
        { error: `ผู้ร่วมเดินทางสูงสุด ${event.guestLimit} ท่าน` },
        { status: 400 },
      );
    }

    // Capacity (total headcount = attending alumni + guests). Subtract this
    // alum's current attending seats so an update isn't double-counted.
    if (v.status === "ATTENDING" && event.capacity != null) {
      const current = await prisma.eventRsvp.findUnique({
        where: { eventId_alumniId: { eventId, alumniId: alumni.id } },
      });
      const currentSeats = current && current.status === "ATTENDING" ? rsvpSeats(current.guestCount) : 0;
      const agg = await prisma.eventRsvp.aggregate({
        where: { eventId, status: "ATTENDING" },
        _count: { _all: true },
        _sum: { guestCount: true },
      });
      const totalHeadcount = agg._count._all + (agg._sum.guestCount ?? 0);
      if (!fitsCapacity(totalHeadcount - currentSeats, rsvpSeats(guestCount), event.capacity)) {
        return NextResponse.json({ error: "กิจกรรมเต็มแล้ว", code: "EVENT_FULL" }, { status: 400 });
      }
    }

    const existed = await prisma.eventRsvp.findUnique({
      where: { eventId_alumniId: { eventId, alumniId: alumni.id } },
      select: { id: true },
    });
    const rsvp = await prisma.eventRsvp.upsert({
      where: { eventId_alumniId: { eventId, alumniId: alumni.id } },
      create: { eventId, alumniId: alumni.id, status: v.status, guestCount: v.status === "ATTENDING" ? guestCount : 0 },
      update: { status: v.status, guestCount: v.status === "ATTENDING" ? guestCount : 0 },
    });

    await logActivity(
      alumniLogCtx(alumni),
      existed ? "UPDATE" : "CREATE",
      "event_rsvp",
      rsvp.id,
      { eventId, status: v.status, guestCount: v.status === "ATTENDING" ? guestCount : 0 },
    );

    // Best-effort: tell the alumni organizer about a NEW attending RSVP.
    if (!existed && v.status === "ATTENDING" && event.organizerAlumniId) {
      await emitNotification({
        alumniId: event.organizerAlumniId,
        type: "RSVP_ON_MY_EVENT",
        entityId: eventId,
        eventTitle: event.title,
        skipAlumniId: alumni.id,
      });
    }

    return NextResponse.json({ status: rsvp.status, guestCount: rsvp.guestCount });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/events/[id]/rsvp error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลงทะเบียน" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveEventReader();
    if ("error" in reader) return reader.error;
    if (!reader.alumni) {
      return NextResponse.json({ error: "การลงทะเบียนเป็นฟังก์ชันของศิษย์เก่า" }, { status: 403 });
    }
    const alumni = reader.alumni;
    const { id: eventId } = await params;

    const existing = await prisma.eventRsvp.findUnique({
      where: { eventId_alumniId: { eventId, alumniId: alumni.id } },
    });
    if (!existing) return NextResponse.json({ success: true }); // idempotent
    await prisma.eventRsvp.delete({ where: { id: existing.id } });
    await logActivity(alumniLogCtx(alumni), "DELETE", "event_rsvp", existing.id, { eventId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/events/[id]/rsvp error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการยกเลิก" }, { status: 500 });
  }
}

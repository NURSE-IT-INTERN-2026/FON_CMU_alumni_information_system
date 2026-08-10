import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { logActivity } from "@/lib/activity-log";
import { resolveEventReader, resolveEventCreator, adminLogCtx, alumniLogCtx } from "@/lib/event-guard";
import { communityRateLimit, COMMUNITY_POST_LIMIT } from "@/lib/community-rate-limit";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { bangkokDatetimeLocalToIso } from "@/lib/event-format";
import { handleZodError, eventCreateSchema } from "@/lib/validations";

// Uniform organizer object for the response: alumni organizers carry their
// public identity; staff organizers carry a name; null if the account was removed.
function shapeOrganizer(ev: {
  organizerAlumni?: { id: string; prefix: string; firstName: string; lastName: string; cohort: string | null; degreeLevel: string; photoUrl: string | null } | null;
  organizerUser?: { id: string; firstName: string; lastName: string } | null;
}) {
  if (ev.organizerAlumni) return { type: "alumni" as const, ...ev.organizerAlumni };
  if (ev.organizerUser) return { type: "staff" as const, id: ev.organizerUser.id, name: `${ev.organizerUser.firstName} ${ev.organizerUser.lastName}`.trim() };
  return null;
}

const ORGANIZER_INCLUDE = {
  organizerAlumni: { select: SELECT_ALUMNI_PUBLIC_IDENTITY },
  organizerUser: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function GET(request: NextRequest) {
  try {
    const reader = await resolveEventReader();
    if ("error" in reader) return reader.error;

    const { searchParams } = request.nextUrl;
    const { page, pageSize } = clampPaging(
      parseInt(searchParams.get("page") || "1", 10),
      parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10),
    );
    const search = (searchParams.get("search") || "").trim();
    const scope = searchParams.get("scope") === "past" ? "past" : "upcoming";
    const now = new Date();

    const where: Prisma.CommunityEventWhereInput = { deletedAt: null };
    if (scope === "upcoming") {
      where.startAt = { gte: now };
    } else {
      where.startAt = { lt: now };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    const [events, total] = await Promise.all([
      prisma.communityEvent.findMany({
        where,
        include: ORGANIZER_INCLUDE,
        orderBy: { startAt: scope === "upcoming" ? "asc" : "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.communityEvent.count({ where }),
    ]);

    // Per-event attendee headcount (attending alumni + their guests) via one groupBy.
    const ids = events.map((e) => e.id);
    const stats = ids.length
      ? await prisma.eventRsvp.groupBy({
          by: ["eventId"],
          where: { eventId: { in: ids }, status: "ATTENDING" },
          _count: { _all: true },
          _sum: { guestCount: true },
        })
      : [];
    const headcount = new Map(stats.map((s) => [s.eventId, s._count._all + (s._sum.guestCount ?? 0)]));

    const data = events.map((e) => {
      const hc = headcount.get(e.id) ?? 0;
      const isFull = e.capacity != null && hc >= e.capacity;
      return { ...e, organizer: shapeOrganizer(e), headcount: hc, isFull };
    });

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const creator = await resolveEventCreator();
    if ("error" in creator) return creator.error;

    const rl = communityRateLimit(request, "post", COMMUNITY_POST_LIMIT);
    if (rl) return rl;

    const v = eventCreateSchema.parse(await request.json());
    const startAt = new Date(bangkokDatetimeLocalToIso(v.startAt));
    const endAt = v.endAt ? new Date(bangkokDatetimeLocalToIso(v.endAt)) : null;

    const event = await prisma.communityEvent.create({
      data: {
        organizerAlumniId: "alumni" in creator ? creator.alumni.id : null,
        organizerUserId: "staff" in creator ? creator.staff.user.id : null,
        title: v.title,
        description: v.description,
        startAt,
        endAt,
        location: v.location?.trim() || null,
        onlineLink: v.onlineLink?.trim() || null,
        coverImageUrl: v.coverImageUrl || null,
        capacity: v.capacity ?? null,
        guestLimit: v.guestLimit,
      },
      include: ORGANIZER_INCLUDE,
    });

    const actor = "staff" in creator
      ? adminLogCtx(creator.staff)
      : alumniLogCtx(creator.alumni);
    await logActivity(actor, "CREATE", "community_event", event.id, { title: event.title });

    return NextResponse.json({ ...event, organizer: shapeOrganizer(event), headcount: 0, isFull: false }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/events error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างกิจกรรม" }, { status: 500 });
  }
}

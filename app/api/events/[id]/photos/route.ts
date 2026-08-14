import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { logActivity } from "@/lib/activity-log";
import { resolveEventReader, alumniLogCtx } from "@/lib/event-guard";
import { communityRateLimit, COMMUNITY_UPLOAD_LIMIT } from "@/lib/community-rate-limit";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { canUploadEventPhoto } from "@/lib/event-photo-gate";
import { handleZodError, eventPhotoCreateSchema } from "@/lib/validations";

/**
 * Event photo album (community V2). GET = paginated album (broadcast read,
 * like events). POST = register an uploaded photo (`{imageUrl, caption}` —
 * the bytes went through /api/alumni-upload first). Upload gate: ATTENDING
 * alum, the alumni organizer, or staff.
 */
const INCLUDE = { uploader: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } } as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveEventReader();
    if ("error" in reader) return reader.error;

    const { id } = await params;
    const event = await prisma.communityEvent.findFirst({ where: { id, deletedAt: null } });
    if (!event) return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });

    const { searchParams } = request.nextUrl;
    const { page, pageSize } = clampPaging(
      parseInt(searchParams.get("page") || "1", 10),
      parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10),
    );

    const where = { eventId: id, deletedAt: null };
    const [photos, total] = await Promise.all([
      prisma.eventPhoto.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.eventPhoto.count({ where }),
    ]);

    // The viewer's delete rights per photo (uploader-or-staff) — pure fn.
    const viewer = { isStaff: !!reader.staff, alumniId: reader.alumni?.id };
    const data = photos.map((p) => ({
      ...p,
      canDelete:
        p.uploaderAlumniId === viewer.alumniId || viewer.isStaff,
    }));

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("GET /api/events/[id]/photos error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลอัลบั้ม" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveEventReader();
    if ("error" in reader) return reader.error;

    const rl = communityRateLimit(request, "upload", COMMUNITY_UPLOAD_LIMIT);
    if (rl) return rl;

    const { id } = await params;
    const event = await prisma.communityEvent.findFirst({ where: { id, deletedAt: null } });
    if (!event) return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });

    // Attendance check via ONE query over ATTENDING RSVPs.
    const attending = await prisma.eventRsvp.findMany({
      where: { eventId: id, status: "ATTENDING" },
      select: { alumniId: true },
    });
    const allowed = canUploadEventPhoto({
      isStaff: !!reader.staff,
      alumniId: reader.alumni?.id,
      attendingAlumniIds: attending.map((r) => r.alumniId),
      organizerAlumniId: event.organizerAlumniId,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "อัปโหลดรูปได้เฉพาะผู้ที่ลงทะเบียนเข้าร่วมกิจกรรมนี้", code: "NOT_ATTENDEE" },
        { status: 403 },
      );
    }

    const v = eventPhotoCreateSchema.parse(await request.json());
    const photo = await prisma.eventPhoto.create({
      data: {
        eventId: id,
        uploaderAlumniId: reader.alumni?.id ?? null,
        imageUrl: v.imageUrl,
        caption: v.caption?.trim() || null,
      },
      include: INCLUDE,
    });

    if (reader.alumni) {
      await logActivity(alumniLogCtx(reader.alumni), "CREATE", "event_photo", photo.id, {
        eventId: id,
        eventTitle: event.title,
      });
    }

    return NextResponse.json({ ...photo, canDelete: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/events/[id]/photos error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการอัปโหลดรูป" }, { status: 500 });
  }
}

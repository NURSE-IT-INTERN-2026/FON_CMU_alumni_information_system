import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { resolveEventReader, adminLogCtx } from "@/lib/event-guard";
import { bangkokDatetimeLocalToIso } from "@/lib/event-format";
import { handleZodError, announcementCreateSchema } from "@/lib/validations";

/**
 * Staff announcements for the alumni community (V2). GET = broadcast read
 * (staff OR any ACTIVE alum, like events): non-expired, pinned first, and —
 * for alumni — `?since=true` compares against the caller's
 * `announcementsLastReadAt` watermark and returns `newCount` (used by the
 * alumni page's ใหม่ badge) WITHOUT updating it (the page updates the
 * watermark itself once the list is actually viewed).
 * POST = staff-only creation.
 */

function adminUnauthorized() {
  return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  try {
    const reader = await resolveEventReader();
    if ("error" in reader) return reader.error;

    const now = new Date();
    const where = {
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    };

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: { authorUser: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ pinnedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        take: 100,
      }),
      prisma.announcement.count({ where }),
    ]);

    let newCount: number | undefined;
    if (reader.alumni && request.nextUrl.searchParams.get("since") === "true") {
      const watermark = reader.alumni.announcementsLastReadAt;
      newCount = items.filter((a) => !watermark || a.createdAt > watermark).length;
    }

    return NextResponse.json({ data: items, total, ...(newCount !== undefined ? { newCount } : {}) });
  } catch (error) {
    console.error("GET /api/announcements error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลประกาศ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await getSession();
    if (!staff) return adminUnauthorized();
    const permErr = await checkWritePermission();
    if (permErr) return permErr;

    const v = announcementCreateSchema.parse(await request.json());

    const announcement = await prisma.announcement.create({
      data: {
        authorUserId: staff.user.id,
        title: v.title,
        body: v.body,
        pinnedAt: v.pinned ? new Date() : null,
        expiresAt: v.expiresAt ? new Date(bangkokDatetimeLocalToIso(v.expiresAt)) : null,
      },
      include: { authorUser: { select: { id: true, firstName: true, lastName: true } } },
    });

    await logActivity(
      adminLogCtx(staff),
      "CREATE",
      "announcement",
      announcement.id,
      { title: announcement.title, pinned: v.pinned },
    );

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/announcements error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างประกาศ" }, { status: 500 });
  }
}

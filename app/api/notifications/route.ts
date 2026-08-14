import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { getAlumniSession } from "@/lib/auth";

/**
 * The logged-in alum's own notification center (community V2). GET = paginated
 * list (unread first). POST = mark read — `{ids?: string[], all?: boolean}`
 * (ids-scoped or everything).
 */

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).max(500).optional(),
  all: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const { page, pageSize } = clampPaging(
      parseInt(searchParams.get("page") || "1", 10),
      parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10),
    );

    const where = { alumniId: session.alumni.id };
    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);

    return NextResponse.json({
      data,
      total,
      unreadCount,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const v = markReadSchema.parse(await request.json().catch(() => ({})));
    const now = new Date();
    const where = v.all
      ? { alumniId: session.alumni.id, readAt: null }
      : { alumniId: session.alumni.id, readAt: null, id: { in: v.ids ?? [] } };

    const result = await prisma.notification.updateMany({ where, data: { readAt: now } });
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
    }
    console.error("POST /api/notifications error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึก" }, { status: 500 });
  }
}

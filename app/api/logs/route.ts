import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const resource = searchParams.get("resource") || "";
    const action = searchParams.get("action") || "";
    const userId = searchParams.get("userId") || "";
    const source = searchParams.get("source") || "";

    const where: Record<string, unknown> = {};
    if (resource) where.resource = resource;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (source === "alumni") where.actorType = "ALUMNI";
    else if (source === "admin") where.actorType = "ADMIN";
    else if (source === "system") where.actorType = "SYSTEM";

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("GET /api/logs error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
}

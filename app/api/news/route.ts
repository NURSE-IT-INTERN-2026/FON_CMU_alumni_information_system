import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession, getAlumniSession } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, newsCreateSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);
    const search = searchParams.get("search") || "";
    const statusParam = searchParams.get("status") || "";

    // No public/anonymous browsing (PRD §1/§3.12): news is readable only by
    // authenticated staff (any status) or alumni (PUBLISHED only). proxy.ts only
    // checks for a cookie, so enforce a valid session here too.
    const [adminSession, alumniSession] = await Promise.all([
      getSession(),
      getAlumniSession(),
    ]);
    if (!adminSession && !alumniSession) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    const where: Prisma.NewsWhereInput = {};

    if (adminSession) {
      // Staff: honor an explicit status filter, otherwise return all statuses.
      if (statusParam) {
        where.status = statusParam as Prisma.EnumNewsStatusFilter["equals"];
      }
    } else {
      // Alumni: published news only.
      where.status = "PUBLISHED";
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.news.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("GET /api/news error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลข่าวสาร" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const body = await request.json();
    const validated = newsCreateSchema.parse(body);

    const news = await prisma.news.create({
      data: {
        title: validated.title,
        body: validated.body,
        coverImageUrl: validated.coverImageUrl || null,
        status: validated.status,
        publishedAt: validated.status === "PUBLISHED" ? new Date() : null,
      },
    });

    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "CREATE",
      "news",
      news.id,
      { title: news.title, status: news.status },
    );

    return NextResponse.json(news, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/news error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างข่าวสาร" },
      { status: 500 }
    );
  }
}

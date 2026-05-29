import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity, getIp } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);
    const search = searchParams.get("search") || "";
    const statusParam = searchParams.get("status") || "";

    const session = await getSession();
    const isAdmin = !!session;

    const where: Prisma.NewsWhereInput = {};

    if (!isAdmin) {
      where.status = "PUBLISHED";
    } else if (statusParam) {
      where.status = statusParam as Prisma.EnumNewsStatusFilter["equals"];
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
    const { title, body: newsBody, coverImageUrl, status } = body;

    if (!title || !newsBody) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อเรื่องและเนื้อหา" },
        { status: 400 }
      );
    }

    const news = await prisma.news.create({
      data: {
        title,
        body: newsBody,
        coverImageUrl: coverImageUrl || null,
        status: status || "DRAFT",
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
    });

    await logActivity(
      { userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "CREATE",
      "news",
      news.id,
      { title: news.title, status: news.status },
      getIp(request)
    );

    return NextResponse.json(news, { status: 201 });
  } catch (error) {
    console.error("POST /api/news error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างข่าวสาร" },
      { status: 500 }
    );
  }
}

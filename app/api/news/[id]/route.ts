import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const news = await prisma.news.findUnique({ where: { id } });

    if (!news) {
      return NextResponse.json(
        { error: "ไม่พบข่าวสาร" },
        { status: 404 }
      );
    }

    return NextResponse.json(news);
  } catch (error) {
    console.error("GET /api/news/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลข่าวสาร" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบข่าวสาร" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.body !== undefined) updateData.body = body.body;
    if (body.coverImageUrl !== undefined) updateData.coverImageUrl = body.coverImageUrl;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
        updateData.publishedAt = new Date();
      }
    }

    const news = await prisma.news.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(news);
  } catch (error) {
    console.error("PUT /api/news/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปเดตข่าวสาร" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบข่าวสาร" },
        { status: 404 }
      );
    }

    await prisma.news.delete({ where: { id } });

    return NextResponse.json({ message: "ลบข่าวสารสำเร็จ" });
  } catch (error) {
    console.error("DELETE /api/news/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบข่าวสาร" },
      { status: 500 }
    );
  }
}

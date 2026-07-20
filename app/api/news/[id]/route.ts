import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession, getAlumniSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, newsUpdateSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // No public/anonymous browsing: require a staff or alumni session.
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

    const news = await prisma.news.findUnique({ where: { id } });

    if (!news) {
      return NextResponse.json(
        { error: "ไม่พบข่าวสาร" },
        { status: 404 }
      );
    }

    // Alumni (no admin session) and the read-only "executive" role can only
    // read published news; other staff can preview any status.
    const isExecutive = !!adminSession && adminSession.user.role === "executive";
    if ((!adminSession || isExecutive) && news.status !== "PUBLISHED") {
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
    const validated = newsUpdateSchema.parse(body);

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบข่าวสาร" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.body !== undefined) updateData.body = validated.body;
    if (validated.coverImageUrl !== undefined) updateData.coverImageUrl = validated.coverImageUrl;
    if (validated.status !== undefined) {
      updateData.status = validated.status;
      if (validated.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
        updateData.publishedAt = new Date();
      }
      // Discontinuing clears the pin (pinned ⇒ not-discontinued).
      if (validated.status === "DISCONTINUED") {
        updateData.pinnedAt = null;
      }
    }

    const news = await prisma.news.update({
      where: { id },
      data: updateData,
    });

    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "UPDATE",
      "news",
      id,
      { title: news.title, status: news.status },
    );

    return NextResponse.json(news);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
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

    // PRD §3.12: news "delete" discontinues the article (sets status), it does not hard-delete.
    // Discontinuing also clears the pin (pinned ⇒ not-discontinued); restoring is not auto-repinned.
    await prisma.news.update({ where: { id }, data: { status: "DISCONTINUED", pinnedAt: null } });

    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "DELETE",
      "news",
      id,
      { title: existing.title, status: "DISCONTINUED" },
    );

    return NextResponse.json({ message: "ยุติการเผยแพร่ข่าวสารสำเร็จ" });
  } catch (error) {
    console.error("DELETE /api/news/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบข่าวสาร" },
      { status: 500 }
    );
  }
}

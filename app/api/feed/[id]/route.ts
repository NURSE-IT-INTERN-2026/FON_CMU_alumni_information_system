import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getAlumniSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { resolveForumReader, resolveForumStaffOrOwner, alumniLogCtx } from "@/lib/forum-guard";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { handleZodError, feedPostUpdateSchema } from "@/lib/validations";

const INCLUDE = {
  author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY },
  comments: {
    where: { deletedAt: null },
    include: { author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } },
    orderBy: { createdAt: "asc" },
    take: 50,
  },
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveForumReader();
    if ("error" in reader) return reader.error;
    const { id } = await params;

    const post = await prisma.feedPost.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
    if (!post) return NextResponse.json({ error: "ไม่พบโพสต์" }, { status: 404 });

    let likedByMe = false;
    if (reader.alumni) {
      likedByMe = !!(await prisma.feedLike.findUnique({
        where: { postId_alumniId: { postId: id, alumniId: reader.alumni.id } },
      }));
    }
    return NextResponse.json({ ...post, likedByMe });
  } catch (error) {
    console.error("GET /api/feed/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const alumni = session.alumni;
    const { id } = await params;

    const existing = await prisma.feedPost.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "ไม่พบโพสต์" }, { status: 404 });
    if (existing.authorId !== alumni.id) {
      return NextResponse.json({ error: "คุณไม่สามารถแก้ไขโพสต์ของผู้อื่นได้" }, { status: 403 });
    }

    const v = feedPostUpdateSchema.parse(await request.json());
    const updated = await prisma.feedPost.update({
      where: { id },
      data: { body: v.body ?? undefined, imageUrl: v.imageUrl === undefined ? undefined : v.imageUrl || null },
      include: INCLUDE,
    });
    await logActivity(alumniLogCtx(alumni), "UPDATE", "feed_post", id, {});
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/feed/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึก" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const who = await resolveForumStaffOrOwner();
    if ("error" in who) return who.error;
    const { id } = await params;

    const existing = await prisma.feedPost.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "ไม่พบโพสต์" }, { status: 404 });

    if (who.staff) {
      const permErr = await checkWritePermission();
      if (permErr) return permErr;
    } else if (existing.authorId !== who.alumni!.id) {
      return NextResponse.json({ error: "คุณไม่สามารถลบโพสต์ของผู้อื่นได้" }, { status: 403 });
    }

    await prisma.feedPost.update({ where: { id }, data: { deletedAt: new Date() } });
    const actor = who.staff
      ? { actorType: "ADMIN" as const, userId: who.staff.user.id, userEmail: who.staff.user.email, userRole: who.staff.user.role }
      : alumniLogCtx(who.alumni!);
    await logActivity(actor, "DELETE", "feed_post", id, {});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/feed/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบ" }, { status: 500 });
  }
}

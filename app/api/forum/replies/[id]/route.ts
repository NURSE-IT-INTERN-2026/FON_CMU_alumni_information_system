import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getAlumniSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { resolveForumStaffOrOwner, alumniLogCtx } from "@/lib/forum-guard";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { handleZodError, forumReplyUpdateSchema } from "@/lib/validations";

const INCLUDE = { author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } } as const;

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

    const existing = await prisma.forumReply.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบความคิดเห็น" }, { status: 404 });
    }
    if (existing.authorId !== alumni.id) {
      return NextResponse.json(
        { error: "คุณไม่สามารถแก้ไขความคิดเห็นของผู้อื่นได้" },
        { status: 403 },
      );
    }

    const validated = forumReplyUpdateSchema.parse(await request.json());
    const updated = await prisma.forumReply.update({
      where: { id },
      data: validated,
      include: INCLUDE,
    });

    await logActivity(alumniLogCtx(alumni), "UPDATE", "forum_reply", id, { topicId: existing.topicId });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/forum/replies/[id] error:", error);
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

    const existing = await prisma.forumReply.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบความคิดเห็น" }, { status: 404 });
    }

    const isOwner = who.alumni && existing.authorId === who.alumni.id;
    if (who.staff) {
      const permErr = await checkWritePermission();
      if (permErr) return permErr;
    } else if (!isOwner) {
      return NextResponse.json(
        { error: "คุณไม่สามารถลบความคิดเห็นของผู้อื่นได้" },
        { status: 403 },
      );
    }

    // Soft-delete + recompute the topic's denormalized counters atomically.
    await prisma.$transaction(async (tx) => {
      await tx.forumReply.update({ where: { id }, data: { deletedAt: new Date() } });
      const remaining = await tx.forumReply.findFirst({
        where: { topicId: existing.topicId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      await tx.forumTopic.update({
        where: { id: existing.topicId },
        data: {
          replyCount: { decrement: 1 },
          lastReplyAt: remaining?.createdAt ?? null,
        },
      });
    });

    const actor = who.staff
      ? {
          actorType: "ADMIN" as const,
          userId: who.staff.user.id,
          userEmail: who.staff.user.email,
          userRole: who.staff.user.role,
        }
      : alumniLogCtx(who.alumni!);
    await logActivity(actor, "DELETE", "forum_reply", id, {
      topicId: existing.topicId,
      ...(who.staff ? { moderation: true } : {}),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/forum/replies/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบ" }, { status: 500 });
  }
}

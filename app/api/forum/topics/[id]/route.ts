import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getAlumniSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { resolveForumReader, resolveForumStaffOrOwner, alumniLogCtx } from "@/lib/forum-guard";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { handleZodError, forumTopicUpdateSchema } from "@/lib/validations";

const INCLUDE = {
  author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY },
  group: { select: { id: true, slug: true, title: true } },
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveForumReader();
    if ("error" in reader) return reader.error;

    const { id } = await params;
    const topic = await prisma.forumTopic.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!topic) {
      return NextResponse.json({ error: "ไม่พบกระทู้" }, { status: 404 });
    }
    return NextResponse.json(topic);
  } catch (error) {
    console.error("GET /api/forum/topics/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Editing own content stays allowed after opt-out (privacy-positive), so
    // this checks the alumni session directly rather than requireForumAlumni.
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const alumni = session.alumni;
    const { id } = await params;

    const existing = await prisma.forumTopic.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบกระทู้" }, { status: 404 });
    }
    // Author-only. Admins moderate via DELETE, not edit.
    if (existing.authorId !== alumni.id) {
      return NextResponse.json(
        { error: "คุณไม่สามารถแก้ไขกระทู้ของผู้อื่นได้" },
        { status: 403 },
      );
    }

    const validated = forumTopicUpdateSchema.parse(await request.json());
    const updated = await prisma.forumTopic.update({
      where: { id },
      data: validated,
      include: INCLUDE,
    });

    await logActivity(alumniLogCtx(alumni), "UPDATE", "forum_topic", id, {
      title: updated.title,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/forum/topics/[id] error:", error);
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

    const existing = await prisma.forumTopic.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบกระทู้" }, { status: 404 });
    }

    if (who.staff) {
      // Staff moderation: executive is read-only.
      const permErr = await checkWritePermission();
      if (permErr) return permErr;
      await prisma.$transaction(async (tx) => {
        await tx.forumTopic.update({ where: { id }, data: { deletedAt: new Date() } });
        if (existing.groupId) {
          await tx.communityGroup.update({
            where: { id: existing.groupId },
            data: { topicCount: { decrement: 1 } },
          });
        }
      });
      await logActivity(
        {
          actorType: "ADMIN",
          userId: who.staff.user.id,
          userEmail: who.staff.user.email,
          userRole: who.staff.user.role,
        },
        "DELETE",
        "forum_topic",
        id,
        { title: existing.title, moderation: true },
      );
      return NextResponse.json({ success: true });
    }

    // Alumni: may delete only their own content (no opt-in required post-hoc).
    if (existing.authorId !== who.alumni!.id) {
      return NextResponse.json(
        { error: "คุณไม่สามารถลบกระทู้ของผู้อื่นได้" },
        { status: 403 },
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.forumTopic.update({ where: { id }, data: { deletedAt: new Date() } });
      if (existing.groupId) {
        await tx.communityGroup.update({
          where: { id: existing.groupId },
          data: { topicCount: { decrement: 1 } },
        });
      }
    });
    await logActivity(alumniLogCtx(who.alumni!), "DELETE", "forum_topic", id, {
      title: existing.title,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/forum/topics/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบ" }, { status: 500 });
  }
}

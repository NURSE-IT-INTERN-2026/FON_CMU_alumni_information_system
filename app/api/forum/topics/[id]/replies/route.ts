import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { logActivity } from "@/lib/activity-log";
import { resolveForumReader, requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { handleZodError, forumReplyCreateSchema } from "@/lib/validations";

const INCLUDE = { author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } } as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveForumReader();
    if ("error" in reader) return reader.error;

    const { id: topicId } = await params;
    const { searchParams } = request.nextUrl;
    const { page, pageSize } = clampPaging(
      parseInt(searchParams.get("page") || "1", 10),
      parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10),
    );

    // Hide replies of a soft-deleted topic too.
    const topic = await prisma.forumTopic.findFirst({
      where: { id: topicId, deletedAt: null },
      select: { id: true },
    });
    if (!topic) {
      return NextResponse.json({ error: "ไม่พบกระทู้" }, { status: 404 });
    }

    const where = { topicId, deletedAt: null };
    const [data, total] = await Promise.all([
      prisma.forumReply.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.forumReply.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("GET /api/forum/topics/[id]/replies error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;
    const { id: topicId } = await params;

    const topic = await prisma.forumTopic.findFirst({
      where: { id: topicId, deletedAt: null },
      select: { id: true },
    });
    if (!topic) {
      return NextResponse.json({ error: "ไม่พบกระทู้" }, { status: 404 });
    }

    const validated = forumReplyCreateSchema.parse(await request.json());

    // Create reply + maintain the denormalized topic counters atomically.
    const reply = await prisma.$transaction(async (tx) => {
      const created = await tx.forumReply.create({
        data: { topicId, authorId: alumni.id, body: validated.body },
        include: INCLUDE,
      });
      await tx.forumTopic.update({
        where: { id: topicId },
        data: { replyCount: { increment: 1 }, lastReplyAt: created.createdAt },
      });
      return created;
    });

    await logActivity(alumniLogCtx(alumni), "CREATE", "forum_reply", reply.id, {
      topicId,
    });

    return NextResponse.json(reply, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/forum/topics/[id]/replies error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการตอบกระทู้" }, { status: 500 });
  }
}

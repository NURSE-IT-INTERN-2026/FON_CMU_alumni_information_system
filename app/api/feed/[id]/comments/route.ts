import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { logActivity } from "@/lib/activity-log";
import { resolveForumReader, requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { communityRateLimit, COMMUNITY_POST_LIMIT } from "@/lib/community-rate-limit";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { handleZodError, feedCommentCreateSchema } from "@/lib/validations";
import { emitNotification } from "@/lib/notification-emitter";

const INCLUDE = { author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } } as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveForumReader();
    if ("error" in reader) return reader.error;
    const { id: postId } = await params;
    const { searchParams } = request.nextUrl;
    const { page, pageSize } = clampPaging(
      parseInt(searchParams.get("page") || "1", 10),
      parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10),
    );

    const post = await prisma.feedPost.findFirst({ where: { id: postId, deletedAt: null }, select: { id: true } });
    if (!post) return NextResponse.json({ error: "ไม่พบโพสต์" }, { status: 404 });

    const where = { postId, deletedAt: null };
    const [data, total] = await Promise.all([
      prisma.feedComment.findMany({ where, include: INCLUDE, orderBy: { createdAt: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.feedComment.count({ where }),
    ]);
    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("GET /api/feed/[id]/comments error:", error);
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
    const { id: postId } = await params;

    const rl = communityRateLimit(request, "post", COMMUNITY_POST_LIMIT);
    if (rl) return rl;

    const post = await prisma.feedPost.findFirst({ where: { id: postId, deletedAt: null }, select: { id: true, authorId: true } });
    if (!post) return NextResponse.json({ error: "ไม่พบโพสต์" }, { status: 404 });

    const v = feedCommentCreateSchema.parse(await request.json());
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.feedComment.create({ data: { postId, authorId: alumni.id, body: v.body }, include: INCLUDE });
      await tx.feedPost.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
      return created;
    });

    // Best-effort: tell the post author (never themselves).
    await emitNotification({
      alumniId: post.authorId,
      type: "COMMENT_ON_MY_POST",
      entityId: postId,
      actor: comment.author,
      postSnippet: v.body.slice(0, 120),
      skipAlumniId: alumni.id,
    });

    await logActivity(alumniLogCtx(alumni), "CREATE", "feed_comment", comment.id, { postId });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/feed/[id]/comments error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการแสดงความคิดเห็น" }, { status: 500 });
  }
}

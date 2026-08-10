import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { logActivity } from "@/lib/activity-log";
import { resolveForumReader, requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { handleZodError, feedPostCreateSchema } from "@/lib/validations";

const INCLUDE = { author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } } as const;

export async function GET(request: NextRequest) {
  try {
    const reader = await resolveForumReader();
    if ("error" in reader) return reader.error;

    const { searchParams } = request.nextUrl;
    const { page, pageSize } = clampPaging(
      parseInt(searchParams.get("page") || "1", 10),
      parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10),
    );

    const where: Prisma.FeedPostWhereInput = { deletedAt: null };
    const [posts, total] = await Promise.all([
      prisma.feedPost.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.feedPost.count({ where }),
    ]);

    // Per-post "likedBy me" for the requesting alum (one batched query).
    let likedIds = new Set<string>();
    if (reader.alumni && posts.length) {
      const likes = await prisma.feedLike.findMany({
        where: { postId: { in: posts.map((p) => p.id) }, alumniId: reader.alumni.id },
        select: { postId: true },
      });
      likedIds = new Set(likes.map((l) => l.postId));
    }

    const data = posts.map((p) => ({ ...p, likedByMe: likedIds.has(p.id) }));
    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("GET /api/feed error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;

    const v = feedPostCreateSchema.parse(await request.json());
    const post = await prisma.feedPost.create({
      data: { authorId: alumni.id, body: v.body, imageUrl: v.imageUrl || null },
      include: INCLUDE,
    });

    await logActivity(alumniLogCtx(alumni), "CREATE", "feed_post", post.id, {});
    return NextResponse.json({ ...post, likedByMe: false }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/feed error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างโพสต์" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { logActivity } from "@/lib/activity-log";
import { resolveForumReader, requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { handleZodError, forumTopicCreateSchema } from "@/lib/validations";

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
    const search = (searchParams.get("search") || "").trim();
    const sort = searchParams.get("sort") || "newest";

    const where: Prisma.ForumTopicWhereInput = { deletedAt: null };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.ForumTopicOrderByWithRelationInput[] =
      sort === "latest-reply"
        ? [{ lastReplyAt: { sort: "desc", nulls: "last" } }]
        : sort === "most-replies"
          ? [{ replyCount: "desc" }]
          : [{ createdAt: "desc" }];

    const [data, total] = await Promise.all([
      prisma.forumTopic.findMany({
        where,
        include: INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.forumTopic.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("GET /api/forum/topics error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;

    const validated = forumTopicCreateSchema.parse(await request.json());

    const topic = await prisma.forumTopic.create({
      data: {
        authorId: alumni.id,
        title: validated.title,
        body: validated.body,
        replyCount: 0,
      },
      include: INCLUDE,
    });

    await logActivity(
      alumniLogCtx(alumni),
      "CREATE",
      "forum_topic",
      topic.id,
      { title: topic.title },
    );

    return NextResponse.json(topic, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/forum/topics error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างกระทู้" }, { status: 500 });
  }
}

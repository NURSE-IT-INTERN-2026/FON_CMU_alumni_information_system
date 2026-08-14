import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { logActivity } from "@/lib/activity-log";
import { resolveForumReader, requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { communityRateLimit, COMMUNITY_POST_LIMIT } from "@/lib/community-rate-limit";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { loadGroup, requireGroupMember } from "@/lib/group-guard";
import { handleZodError, forumTopicCreateSchema } from "@/lib/validations";
import { emitToGroupMembers } from "@/lib/notification-emitter";

const INCLUDE = {
  author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY },
  group: { select: { id: true, slug: true, title: true } },
} as const;

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
    // `groupId` scopes the list to one group's space; `groupId=none` (default
    // forum view) shows ONLY forum-wide topics; omitted = everything.
    const groupId = searchParams.get("groupId");

    const where: Prisma.ForumTopicWhereInput = { deletedAt: null };
    if (groupId === "none") where.groupId = null;
    else if (groupId) where.groupId = groupId;
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

    const rl = communityRateLimit(request, "post", COMMUNITY_POST_LIMIT);
    if (rl) return rl;

    const validated = forumTopicCreateSchema.parse(await request.json());

    // Group-scoped topics require membership of that group.
    let groupId: string | null = null;
    if (validated.groupId) {
      const found = await loadGroup(validated.groupId);
      if ("error" in found) return found.error;
      const member = await requireGroupMember(found.group.id);
      if ("error" in member) return member.error;
      groupId = found.group.id;
    }

    const topic = await prisma.$transaction(async (tx) => {
      const created = await tx.forumTopic.create({
        data: {
          authorId: alumni.id,
          groupId,
          title: validated.title,
          body: validated.body,
          replyCount: 0,
        },
        include: INCLUDE,
      });
      if (groupId) {
        await tx.communityGroup.update({
          where: { id: groupId },
          data: { topicCount: { increment: 1 } },
        });
      }
      return created;
    });

    // Best-effort: a new GROUP topic notifies the group's members (capped —
    // groups above GROUP_NOTIFY_CAP are skipped by the emitter itself).
    if (groupId) {
      const [group, memberIds] = await Promise.all([
        prisma.communityGroup.findUnique({ where: { id: groupId }, select: { title: true } }),
        prisma.groupMembership.findMany({
          where: { groupId },
          select: { alumniId: true },
        }),
      ]);
      await emitToGroupMembers({
        groupId,
        memberIds: memberIds.map((m) => m.alumniId),
        type: "NEW_GROUP_TOPIC",
        entityId: topic.id,
        actor: topic.author,
        topicTitle: topic.title,
        groupTitle: group?.title ?? null,
        skipAlumniId: alumni.id,
      });
    }

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

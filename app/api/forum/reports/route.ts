import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { communityRateLimit, COMMUNITY_REPORT_LIMIT } from "@/lib/community-rate-limit";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { handleZodError, forumReportCreateSchema } from "@/lib/validations";

// POST — an opted-in alumni reports a topic or reply. One report per
// (reporter, target); re-reporting re-opens a resolved/dismissed one.
export async function POST(request: NextRequest) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;

    const rl = communityRateLimit(request, "report", COMMUNITY_REPORT_LIMIT);
    if (rl) return rl;

    const validated = forumReportCreateSchema.parse(await request.json());

    // Resolve + validate the target: must exist, not be soft-deleted, and not
    // be the reporter's own content (no self-report).
    const target = await resolveReportTarget(validated.resourceType, validated.resourceId);
    if (!target) {
      return NextResponse.json({ error: "ไม่พบเนื้อหาที่รายงาน" }, { status: 404 });
    }
    if (target.authorId === alumni.id) {
      return NextResponse.json(
        { error: "ไม่สามารถรายงานเนื้อหาของตัวเองได้" },
        { status: 400 },
      );
    }

    const report = await prisma.contentReport.upsert({
      where: {
        reporterId_resourceType_resourceId: {
          reporterId: alumni.id,
          resourceType: validated.resourceType,
          resourceId: validated.resourceId,
        },
      },
      create: {
        reporterId: alumni.id,
        resourceType: validated.resourceType,
        resourceId: validated.resourceId,
        reason: validated.reason,
        reasonDetail: validated.reasonDetail ?? null,
      },
      // Re-open a previously resolved/dismissed report on re-report.
      update: {
        reason: validated.reason,
        reasonDetail: validated.reasonDetail ?? null,
        status: "OPEN",
        resolvedBy: null,
        resolutionNote: null,
      },
    });

    await logActivity(
      alumniLogCtx(alumni),
      "REPORT",
      validated.resourceType === "FORUM_TOPIC"
        ? "forum_topic"
        : validated.resourceType === "FORUM_REPLY"
          ? "forum_reply"
          : validated.resourceType === "EVENT"
            ? "community_event"
            : validated.resourceType === "FEED_POST"
              ? "feed_post"
              : "feed_comment",
      validated.resourceId,
      { reason: validated.reason, reportId: report.id },
    );

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/forum/reports error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการรายงาน" }, { status: 500 });
  }
}

async function resolveReportTarget(
  resourceType: "FORUM_TOPIC" | "FORUM_REPLY" | "EVENT" | "FEED_POST" | "FEED_COMMENT",
  resourceId: string,
): Promise<{ authorId: string | null } | null> {
  if (resourceType === "FORUM_TOPIC") {
    const t = await prisma.forumTopic.findFirst({ where: { id: resourceId, deletedAt: null }, select: { authorId: true } });
    return t;
  }
  if (resourceType === "FORUM_REPLY") {
    const r = await prisma.forumReply.findFirst({ where: { id: resourceId, deletedAt: null }, select: { authorId: true } });
    return r;
  }
  if (resourceType === "EVENT") {
    const ev = await prisma.communityEvent.findFirst({ where: { id: resourceId, deletedAt: null }, select: { organizerAlumniId: true } });
    return ev ? { authorId: ev.organizerAlumniId } : null;
  }
  if (resourceType === "FEED_POST") {
    const p = await prisma.feedPost.findFirst({ where: { id: resourceId, deletedAt: null }, select: { authorId: true } });
    return p;
  }
  // FEED_COMMENT
  const c = await prisma.feedComment.findFirst({ where: { id: resourceId, deletedAt: null }, select: { authorId: true } });
  return c;
}

// GET — staff moderation queue. Executive allowed (read-only — the per-action
// writes are gated by checkWritePermission on the action routes).
export async function GET(request: NextRequest) {
  try {
    const staff = await getSession();
    if (!staff) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const { page, pageSize } = clampPaging(
      parseInt(searchParams.get("page") || "1", 10),
      parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10),
    );
    const statusParam = (searchParams.get("status") || "OPEN").toUpperCase();
    const resourceTypeParam = searchParams.get("resourceType") || "";

    const where: Prisma.ContentReportWhereInput = {};
    if (["OPEN", "RESOLVED", "DISMISSED"].includes(statusParam)) {
      where.status = statusParam as "OPEN" | "RESOLVED" | "DISMISSED";
    }
    if (["FORUM_TOPIC", "FORUM_REPLY", "EVENT", "FEED_POST", "FEED_COMMENT"].includes(resourceTypeParam)) {
      where.resourceType = resourceTypeParam as "FORUM_TOPIC" | "FORUM_REPLY" | "EVENT" | "FEED_POST" | "FEED_COMMENT";
    }

    const [reports, total] = await Promise.all([
      prisma.contentReport.findMany({
        where,
        include: {
          reporter: { select: SELECT_ALUMNI_PUBLIC_IDENTITY },
          resolver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contentReport.count({ where }),
    ]);

    // Batch-fetch the reported targets (topics + replies + events + feed posts +
    // feed comments) so the queue can show the content + its author inline.
    // Deleted targets are included (shown as "ถูกลบแล้ว") so a moderator sees
    // the resolution state.
    const topicIds = reports.filter((r) => r.resourceType === "FORUM_TOPIC").map((r) => r.resourceId);
    const replyIds = reports.filter((r) => r.resourceType === "FORUM_REPLY").map((r) => r.resourceId);
    const eventIds = reports.filter((r) => r.resourceType === "EVENT").map((r) => r.resourceId);
    const feedPostIds = reports.filter((r) => r.resourceType === "FEED_POST").map((r) => r.resourceId);
    const feedCommentIds = reports.filter((r) => r.resourceType === "FEED_COMMENT").map((r) => r.resourceId);

    const [topics, replies, events, feedPosts, feedComments] = await Promise.all([
      topicIds.length ? prisma.forumTopic.findMany({ where: { id: { in: topicIds } }, include: { author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } } }) : [],
      replyIds.length ? prisma.forumReply.findMany({ where: { id: { in: replyIds } }, include: { author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } } }) : [],
      eventIds.length
        ? prisma.communityEvent.findMany({
            where: { id: { in: eventIds } },
            include: { organizerAlumni: { select: SELECT_ALUMNI_PUBLIC_IDENTITY }, organizerUser: { select: { id: true, firstName: true, lastName: true } } },
          })
        : [],
      feedPostIds.length ? prisma.feedPost.findMany({ where: { id: { in: feedPostIds } }, include: { author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } } }) : [],
      feedCommentIds.length ? prisma.feedComment.findMany({ where: { id: { in: feedCommentIds } }, include: { author: { select: SELECT_ALUMNI_PUBLIC_IDENTITY } } }) : [],
    ]);

    const topicById = new Map(topics.map((t) => [t.id, t]));
    const replyById = new Map(replies.map((r) => [r.id, r]));
    const eventById = new Map(events.map((e) => [e.id, e]));
    const feedPostById = new Map(feedPosts.map((p) => [p.id, p]));
    const feedCommentById = new Map(feedComments.map((c) => [c.id, c]));

    const data = reports.map((report) => ({
      ...report,
      topic: report.resourceType === "FORUM_TOPIC" ? topicById.get(report.resourceId) ?? null : null,
      reply: report.resourceType === "FORUM_REPLY" ? replyById.get(report.resourceId) ?? null : null,
      event: report.resourceType === "EVENT" ? eventById.get(report.resourceId) ?? null : null,
      feedPost: report.resourceType === "FEED_POST" ? feedPostById.get(report.resourceId) ?? null : null,
      feedComment: report.resourceType === "FEED_COMMENT" ? feedCommentById.get(report.resourceId) ?? null : null,
    }));

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("GET /api/forum/reports error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

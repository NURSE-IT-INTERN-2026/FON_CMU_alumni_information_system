import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { communityRateLimit, COMMUNITY_POST_LIMIT } from "@/lib/community-rate-limit";
import { handleZodError, mentorshipRequestSchema } from "@/lib/validations";
import { emitNotification } from "@/lib/notification-emitter";

/**
 * Community V2 mentorship requests (opt-in gated). GET = the logged-in alum's
 * sent + received requests (public identity only). POST = request a mentor —
 * blocked if the mentor isn't accepting, if asking yourself, or if the alum
 * already has a PENDING request to that mentor (400 with Thai messages).
 */

const INCLUDE = {
  mentor: { select: SELECT_ALUMNI_PUBLIC_IDENTITY },
  mentee: { select: SELECT_ALUMNI_PUBLIC_IDENTITY },
} as const;

export async function GET() {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;

    const requests = await prisma.mentorshipRequest.findMany({
      where: { OR: [{ mentorId: a.alumni.id }, { menteeId: a.alumni.id }] },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const mine = requests.map((r) => ({
      ...r,
      direction: r.menteeId === a.alumni.id ? ("sent" as const) : ("received" as const),
    }));

    return NextResponse.json({ data: mine });
  } catch (error) {
    console.error("GET /api/mentorship-requests error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลคำขอ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;

    const rl = communityRateLimit(request, "post", COMMUNITY_POST_LIMIT);
    if (rl) return rl;

    const v = mentorshipRequestSchema.parse(await request.json());

    const mentor = await prisma.mentorProfile.findUnique({
      where: { alumniId: v.mentorId },
    });
    if (!mentor || !mentor.accepting) {
      return NextResponse.json(
        { error: "พี่เลี้ยงท่านนี้ยังไม่เปิดรับคำขอในขณะนี้", code: "NOT_ACCEPTING" },
        { status: 400 },
      );
    }
    if (mentor.alumniId === alumni.id) {
      return NextResponse.json({ error: "ไม่สามารถส่งคำขอถึงตัวเองได้" }, { status: 400 });
    }
    const openCount = await prisma.mentorshipRequest.count({
      where: { mentorId: mentor.alumniId, status: "ACCEPTED" },
    });
    if (openCount >= mentor.capacity) {
      return NextResponse.json(
        { error: "พี่เลี้ยงท่านนี้รับผู้รับคำปรึกษาเต็มจำนวนแล้ว", code: "AT_CAPACITY" },
        { status: 400 },
      );
    }
    const dup = await prisma.mentorshipRequest.findFirst({
      where: { mentorId: mentor.alumniId, menteeId: alumni.id, status: "PENDING" },
    });
    if (dup) {
      return NextResponse.json(
        { error: "ท่านมีคำขอที่รอคำตอบอยู่กับพี่เลี้ยงท่านนี้แล้ว", code: "DUPLICATE_PENDING" },
        { status: 400 },
      );
    }

    const created = await prisma.mentorshipRequest.create({
      data: { mentorId: mentor.alumniId, menteeId: alumni.id, message: v.message },
      include: INCLUDE,
    });

    await logActivity(
      alumniLogCtx(alumni),
      "CREATE",
      "mentorship_request",
      created.id,
      { mentorId: mentor.alumniId },
    );

    // Best-effort: tell the mentor.
    await emitNotification({
      alumniId: mentor.alumniId,
      type: "MENTORSHIP_REQUEST",
      entityId: created.id,
      skipAlumniId: alumni.id,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/mentorship-requests error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการส่งคำขอ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { logActivity } from "@/lib/activity-log";
import { resolveForumReader, requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { handleZodError, mentorProfileSchema } from "@/lib/validations";

/**
 * Community V2 mentorship — the volunteer list + the logged-in alum's own
 * MentorProfile. Opt-in gated (like the forum: a mentor's identity is shown
 * to opted-in members only). GET = list (with the mentor's open-request count
 * vs capacity via ONE groupBy) or `?me=true` (own profile). PUT = upsert own.
 * Contact info is NEVER selected here — it leaves the DB only in the accept
 * payload of /api/mentorship-requests/[id].
 */

const INCLUDE = {
  alumni: {
    select: {
      ...SELECT_ALUMNI_PUBLIC_IDENTITY,
      communityProfile: {
        select: { currentWorkplace: true, currentPosition: true, province: true },
      },
    },
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const reader = await resolveForumReader();
    if ("error" in reader) return reader.error;

    const { searchParams } = request.nextUrl;

    if (searchParams.get("me") === "true") {
      const profile = reader.alumni
        ? await prisma.mentorProfile.findUnique({ where: { alumniId: reader.alumni.id } })
        : null;
      return NextResponse.json({ profile });
    }

    const { page, pageSize } = clampPaging(
      parseInt(searchParams.get("page") || "1", 10),
      parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10),
    );
    const search = (searchParams.get("search") || "").trim();
    const showAll = searchParams.get("all") === "true";

    const where: Prisma.MentorProfileWhereInput = {};
    // Default: only mentors who are accepting. `all=true` shows everyone
    // (the mentor page lists paused mentors greyed out).
    if (!showAll) where.accepting = true;
    if (search) {
      where.OR = [
        { expertise: { contains: search, mode: "insensitive" } },
        { alumni: { OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ] } },
      ];
    }

    const [mentors, total] = await Promise.all([
      prisma.mentorProfile.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ accepting: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.mentorProfile.count({ where }),
    ]);

    // Open (PENDING) request count per mentor — one groupBy.
    const open = mentors.length
      ? await prisma.mentorshipRequest.groupBy({
          by: ["mentorId"],
          where: { mentorId: { in: mentors.map((m) => m.alumniId) }, status: "PENDING" },
          _count: { _all: true },
        })
      : [];
    const openByMentor = new Map(open.map((o) => [o.mentorId, o._count._all]));

    const data = mentors.map((m) => ({
      id: m.id,
      alumniId: m.alumniId,
      expertise: m.expertise,
      capacity: m.capacity,
      accepting: m.accepting,
      alumni: m.alumni,
      openRequests: openByMentor.get(m.alumniId) ?? 0,
      isMe: reader.alumni?.id === m.alumniId,
    }));

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("GET /api/mentors error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลพี่เลี้ยง" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;

    const v = mentorProfileSchema.parse(await request.json());

    const profile = await prisma.mentorProfile.upsert({
      where: { alumniId: alumni.id },
      create: { alumniId: alumni.id, expertise: v.expertise, capacity: v.capacity, accepting: v.accepting },
      update: { expertise: v.expertise, capacity: v.capacity, accepting: v.accepting },
    });

    await logActivity(
      alumniLogCtx(alumni),
      "UPDATE",
      "mentor_profile",
      profile.id,
      { expertise: profile.expertise, accepting: profile.accepting },
    );

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/mentors error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกโปรไฟล์พี่เลี้ยง" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { resolveForumReader } from "@/lib/forum-guard";
import { SELECT_ALUMNI_DIRECTORY_IDENTITY } from "@/lib/forum-identity";
import { DEGREE_LEVEL_VALUES } from "@/lib/validations";

/**
 * Alumni directory (community V2) — the opted-in member list. Staff OR
 * opted-in alumni may browse (the same gate as the forum: appearing in the
 * directory is part of what opting in means).
 *
 * Filters: `search` (name / workplace / position), `cohort`, `degreeLevel`,
 * `province`, `country`. Ordered by most-recently-opted-in first — the newest
 * members surface at the top.
 */
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
    const cohort = (searchParams.get("cohort") || "").trim();
    const degreeLevel = (searchParams.get("degreeLevel") || "").trim();
    const province = (searchParams.get("province") || "").trim();
    const country = (searchParams.get("country") || "").trim();

    const where: Prisma.AlumniWhereInput = {
      deletedAt: null,
      communityOptedInAt: { not: null },
    };
    if (cohort) where.cohort = cohort;
    if (degreeLevel && (DEGREE_LEVEL_VALUES as readonly string[]).includes(degreeLevel)) {
      where.degreeLevel = degreeLevel as Prisma.EnumDegreeLevelFilter["equals"];
    }
    // CommunityProfile filters — accumulated separately so the search branch
    // can combine them with the workplace/position OR.
    const profileFilter: Prisma.CommunityProfileWhereInput = {};
    if (province) profileFilter.province = province;
    if (country) profileFilter.country = country;
    if (province || country) where.communityProfile = profileFilter;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        {
          communityProfile: {
            ...profileFilter,
            OR: [
              { currentWorkplace: { contains: search, mode: "insensitive" } },
              { currentPosition: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.alumni.findMany({
        where,
        select: SELECT_ALUMNI_DIRECTORY_IDENTITY,
        orderBy: [{ communityOptedInAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.alumni.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("GET /api/directory error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลไดเรกทอรีศิษย์เก่า" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { logActivity } from "@/lib/activity-log";
import { resolveEventReader, resolveEventCreator, adminLogCtx, alumniLogCtx } from "@/lib/event-guard";
import { communityRateLimit, COMMUNITY_POST_LIMIT } from "@/lib/community-rate-limit";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { bangkokDatetimeLocalToIso } from "@/lib/event-format";
import { handleZodError, jobCreateSchema } from "@/lib/validations";
import { jobCountryWhere, isThailandFilter } from "@/lib/job-country";
import { isThailandCountry } from "@/lib/alumni-agency-region";

/**
 * Community V2 job board. Mirrors the events visibility model: broadcast READ
 * (staff OR any ACTIVE alum — career info is for the whole class), creator-
 * gated WRITE (staff via checkWritePermission or an opted-in alum, dual author
 * FKs). `scope` default "active" hides expired postings.
 */

const AUTHOR_INCLUDE = {
  authorAlumni: { select: SELECT_ALUMNI_PUBLIC_IDENTITY },
  authorUser: { select: { id: true, firstName: true, lastName: true } },
} as const;

function shapeAuthor(j: {
  authorAlumni?: { id: string; prefix: string; firstName: string; lastName: string; cohort: string | null; degreeLevel: string; photoUrl: string | null } | null;
  authorUser?: { id: string; firstName: string; lastName: string } | null;
}) {
  if (j.authorAlumni) return { type: "alumni" as const, ...j.authorAlumni };
  if (j.authorUser) return { type: "staff" as const, id: j.authorUser.id, name: `${j.authorUser.firstName} ${j.authorUser.lastName}`.trim() };
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const reader = await resolveEventReader();
    if ("error" in reader) return reader.error;

    const { searchParams } = request.nextUrl;
    const { page, pageSize } = clampPaging(
      parseInt(searchParams.get("page") || "1", 10),
      parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10),
    );
    const search = (searchParams.get("search") || "").trim();
    const province = (searchParams.get("province") || "").trim();
    const country = (searchParams.get("country") || "").trim();
    const scopeParam = searchParams.get("scope") || "active";
    const scope = (["active", "expired", "mine"] as const).includes(scopeParam as never)
      ? (scopeParam as "active" | "expired" | "mine")
      : "active";
    const now = new Date();

    // Conditions are collected into an AND array (search's OR is one
    // condition) so the country filter can carry its own OR without
    // colliding with the search OR.
    const where: Prisma.JobPostingWhereInput = { deletedAt: null };
    if (scope === "active") where.expiresAt = { gte: now };
    else if (scope === "expired") where.expiresAt = { lt: now };
    if (scope === "mine" && reader.alumni) where.authorAlumniId = reader.alumni.id;

    const conditions: Prisma.JobPostingWhereInput[] = [];
    const countryFilter = jobCountryWhere(country);
    if (countryFilter) conditions.push(countryFilter);
    if (province) {
      // Under Thailand the client sends canonical Thai province names (select)
      // — exact match. Other countries are free text (e.g. "Central") — contains.
      conditions.push(
        isThailandFilter(country)
          ? { province }
          : { province: { contains: province, mode: "insensitive" } },
      );
    }
    if (search) {
      conditions.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { workplace: { contains: search, mode: "insensitive" } },
          { position: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (conditions.length) where.AND = conditions;

    // Distinct non-null countries for the filter dropdown (scope-scoped only,
    // NOT narrowed by country/province/search so the list stays stable while
    // filtering). Thai spellings are excluded — Thailand is a fixed option.
    const countryListWhere: Prisma.JobPostingWhereInput = { deletedAt: null };
    if (scope === "active") countryListWhere.expiresAt = { gte: now };
    else if (scope === "expired") countryListWhere.expiresAt = { lt: now };

    const [jobs, total, countryRows] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        include: AUTHOR_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.jobPosting.count({ where }),
      prisma.jobPosting.findMany({
        where: countryListWhere,
        select: { country: true },
        distinct: ["country"],
      }),
    ]);

    const data = jobs.map((j) => ({
      ...j,
      author: shapeAuthor(j),
      expired: j.expiresAt < now,
    }));
    const countries = [
      ...new Set(
        countryRows
          .map((r) => r.country?.trim())
          .filter((c): c is string => !!c && !isThailandCountry(c)),
      ),
    ].sort((a, b) => a.localeCompare(b, "th"));

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize), countries });
  } catch (error) {
    console.error("GET /api/jobs error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลประกาศงาน" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const creator = await resolveEventCreator();
    if ("error" in creator) return creator.error;

    const rl = communityRateLimit(request, "post", COMMUNITY_POST_LIMIT);
    if (rl) return rl;

    const v = jobCreateSchema.parse(await request.json());
    const expiresAt = new Date(bangkokDatetimeLocalToIso(v.expiresAt));

    const job = await prisma.jobPosting.create({
      data: {
        authorAlumniId: "alumni" in creator ? creator.alumni.id : null,
        authorUserId: "staff" in creator ? creator.staff.user.id : null,
        title: v.title,
        workplace: v.workplace,
        position: v.position?.trim() || null,
        province: v.province?.trim() || null,
        country: v.country?.trim() || null,
        description: v.description,
        applyUrl: v.applyUrl?.trim() || null,
        contactInfo: v.contactInfo?.trim() || null,
        expiresAt,
      },
      include: AUTHOR_INCLUDE,
    });

    const actor = "staff" in creator ? adminLogCtx(creator.staff) : alumniLogCtx(creator.alumni);
    await logActivity(actor, "CREATE", "job_posting", job.id, { title: job.title, workplace: job.workplace });

    return NextResponse.json({ ...job, author: shapeAuthor(job), expired: false }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/jobs error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างประกาศงาน" }, { status: 500 });
  }
}

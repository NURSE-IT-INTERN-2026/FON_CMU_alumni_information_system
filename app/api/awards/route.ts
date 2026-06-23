import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";
import { handleZodError, awardCreateSchema } from "@/lib/validations";
import { parseFacetFilters, FACET_FIELDS } from "@/lib/filter-facets";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const validated = awardCreateSchema.parse(body);

    const award = await prisma.award.create({
      data: {
        studentId: validated.studentId || null,
        prefix: validated.prefix?.trim() || null,
        firstName: validated.firstName.trim(),
        lastName: validated.lastName.trim(),
        awardName: validated.awardName.trim(),
        awardType: validated.awardType,
        year: Number(validated.year),
        link: validated.link?.trim() || null,
        imageUrl: validated.imageUrl?.trim() || null,
        description: validated.description?.trim() || null,
        major: validated.major?.trim() || null,
      },
      include: {
        alumni: { select: { prefix: true, firstName: true, lastName: true } },
      },
    });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "CREATE",
        "award",
        award.id,
        { awardName: award.awardName, awardType: award.awardType, year: award.year },
        getIp(request)
      );
    }

    return NextResponse.json(award, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("Failed to create award:", error);
    return NextResponse.json(
      { error: "Failed to create award" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const search = searchParams.get("search") || "";
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);
    const sortField = searchParams.get("sortField") || "year";
    const sortDir = searchParams.get("sortDir") || "desc";
    const searchFieldParam = searchParams.get("searchField") || "all";

    const validSearchFields = ["awardName", "firstName", "lastName", "description", "name", "year"];

    const where: Record<string, unknown> = { deletedAt: null };
    Object.assign(where, parseFacetFilters(searchParams, FACET_FIELDS.awards));

    if (search) {
      if (searchFieldParam && validSearchFields.includes(searchFieldParam)) {
        if (searchFieldParam === "year") {
          where.year = Number(search) || undefined;
        } else if (searchFieldParam === "name") {
          where.OR = [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { alumni: { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }] } },
          ];
        } else {
          where[searchFieldParam] = { contains: search, mode: "insensitive" };
        }
      } else {
        where.OR = [
          { awardName: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          {
            alumni: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ];
      }
    }

    const sortFieldMap: Record<string, string> = { name: "firstName", award: "awardName", type: "awardType", year: "year", major: "major", description: "description", studentId: "studentId", prefix: "prefix", lastName: "lastName" };
    const orderKey = sortFieldMap[sortField] || "year";
    const dir = sortDir === "asc" ? "asc" : "desc";

    const [awards, total] = await Promise.all([
      prisma.award.findMany({
        where,
        include: {
          alumni: {
            select: {
              prefix: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { [orderKey]: dir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.award.count({ where }),
    ]);

    return NextResponse.json({
      data: awards,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch awards:", error);
    return NextResponse.json(
      { error: "Failed to fetch awards" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { handleZodError, alumniAgencyCreateSchema } from "@/lib/validations";
import { parseFacetFilters, FACET_FIELDS } from "@/lib/filter-facets";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const validated = alumniAgencyCreateSchema.parse(body);

    const item = await prisma.alumniAgency.create({
      data: {
        cohort: validated.cohort?.trim() || null,
        prefix: validated.prefix?.trim() || null,
        thaiName: validated.thaiName?.trim() || null,
        englishName: validated.englishName?.trim() || null,
        workplace: validated.workplace?.trim() || null,
        homeAddress: validated.homeAddress?.trim() || null,
        country: validated.country,
        notes: validated.notes?.trim() || null,
        major: validated.major?.trim() || null,
        studentId: validated.studentId?.trim() || null,
        order: validated.order,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("Failed to create alumni agency:", error);
    return NextResponse.json(
      { error: "Failed to create alumni agency" },
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
    const search = searchParams.get("search") || "";
    const searchFieldParam = searchParams.get("searchField") || "all";

    const validSearchFields = ["thaiName", "englishName", "country", "workplace", "homeAddress", "cohort"];

    const where: Record<string, unknown> = { deletedAt: null };
    Object.assign(where, parseFacetFilters(searchParams, FACET_FIELDS["alumni-agency"]));

    if (search) {
      if (searchFieldParam && validSearchFields.includes(searchFieldParam)) {
        where[searchFieldParam] = { contains: search, mode: "insensitive" };
      } else {
        where.OR = [
          { thaiName: { contains: search, mode: "insensitive" } },
          { englishName: { contains: search, mode: "insensitive" } },
          { workplace: { contains: search, mode: "insensitive" } },
          { country: { contains: search, mode: "insensitive" } },
          { homeAddress: { contains: search, mode: "insensitive" } },
          { cohort: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const [alumni, countries] = await Promise.all([
      prisma.alumniAgency.findMany({
        where,
        orderBy: [{ country: "asc" }, { order: "asc" }],
      }),
      prisma.alumniAgency.findMany({
        where: { deletedAt: null },
        select: { country: true },
        distinct: ["country"],
        orderBy: { country: "asc" },
      }),
    ]);

    return NextResponse.json({
      data: alumni,
      countries: countries.map((c) => c.country),
    });
  } catch (error) {
    console.error("Failed to fetch alumni agency:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni agency" },
      { status: 500 }
    );
  }
}

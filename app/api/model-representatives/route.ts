import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { handleZodError, modelRepCreateSchema } from "@/lib/validations";
import { parseFacetFilters, FACET_FIELDS } from "@/lib/filter-facets";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const validated = modelRepCreateSchema.parse(body);

    const item = await prisma.modelRepresentative.create({
      data: {
        studentId: validated.studentId?.trim() || null,
        prefix: validated.prefix?.trim() || null,
        firstName: validated.firstName.trim(),
        lastName: validated.lastName.trim(),
        cohort: validated.cohort.trim(),
        generation: Number(validated.generation),
        major: validated.major?.trim() || null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("Failed to create model representative:", error);
    return NextResponse.json(
      { error: "Failed to create model representative" },
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
    const searchField = searchParams.get("searchField") || "";

    const validSearchFields = ["studentId", "name", "firstName", "lastName", "cohort"];
    const where: Record<string, unknown> = { deletedAt: null };
    Object.assign(where, parseFacetFilters(searchParams, FACET_FIELDS["model-representatives"]));

    // `?unlinked=true` — show only rows flagged รอเชื่อมโยง (no Alumni to link).
    if (searchParams.get("unlinked") === "true") {
      where.pendingStudentId = { not: null };
    }

    if (search) {
      if (searchField && validSearchFields.includes(searchField)) {
        if (searchField === "name") {
          where.OR = [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ];
        } else if (searchField === "studentId") {
          // Search the effective id — linked `studentId` OR pending `pendingStudentId`.
          where.OR = [
            { studentId: { contains: search, mode: "insensitive" } },
            { pendingStudentId: { contains: search, mode: "insensitive" } },
          ];
        } else {
          where[searchField] = { contains: search, mode: "insensitive" };
        }
      } else {
        where.OR = [
          { studentId: { contains: search, mode: "insensitive" } },
          { pendingStudentId: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { cohort: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const alumni = await prisma.modelRepresentative.findMany({
      where,
      orderBy: [{ cohort: "asc" }, { generation: "asc" }],
    });

    return NextResponse.json({ data: alumni });
  } catch (error) {
    console.error("Failed to fetch model representatives:", error);
    return NextResponse.json(
      { error: "Failed to fetch model representatives" },
      { status: 500 }
    );
  }
}

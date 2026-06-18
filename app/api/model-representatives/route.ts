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
        studentId: validated.studentId.trim(),
        name: validated.name.trim(),
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

    const where: Record<string, unknown> = { deletedAt: null };
    Object.assign(where, parseFacetFilters(searchParams, FACET_FIELDS["model-representatives"]));

    if (search) {
      where.OR = [
        { studentId: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { cohort: { contains: search, mode: "insensitive" } },
      ];
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

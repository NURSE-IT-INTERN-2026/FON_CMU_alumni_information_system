import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { handleZodError, potentialCreateSchema } from "@/lib/validations";
import { parseFacetFilters, FACET_FIELDS } from "@/lib/filter-facets";

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
    const searchField = searchParams.get("searchField") || "";
    const sortBy = searchParams.get("sortBy") || "recordedYear";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const validSearchFields = ["studentId", "fullName", "career", "position", "recordedYear"];
    const where: Record<string, unknown> = { deletedAt: null };
    Object.assign(where, parseFacetFilters(searchParams, FACET_FIELDS.potentials));

    if (search) {
      if (searchField && validSearchFields.includes(searchField)) {
        if (searchField === "recordedYear") {
          where[searchField] = Number(search) || undefined;
        } else {
          where[searchField] = { contains: search, mode: "insensitive" };
        }
      } else {
        where.OR = [
          { studentId: { contains: search, mode: "insensitive" } },
          { fullName: { contains: search, mode: "insensitive" } },
          { career: { contains: search, mode: "insensitive" } },
          { position: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const [potentials, total] = await Promise.all([
      prisma.potential.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.potential.count({ where }),
    ]);

    return NextResponse.json({
      data: potentials,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch potentials:", error);
    return NextResponse.json(
      { error: "Failed to fetch potentials" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const validated = potentialCreateSchema.parse(body);

    const potential = await prisma.potential.create({
      data: {
        studentId: validated.studentId.trim(),
        fullName: validated.fullName.trim(),
        career: validated.career.trim(),
        position: validated.position.trim(),
        recordedYear: Number(validated.recordedYear),
      },
    });

    return NextResponse.json(potential, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("Failed to create potential:", error);
    return NextResponse.json(
      { error: "Failed to create potential" },
      { status: 500 }
    );
  }
}

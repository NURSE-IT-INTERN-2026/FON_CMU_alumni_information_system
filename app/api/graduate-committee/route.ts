import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { handleZodError, committeeCreateSchema } from "@/lib/validations";
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
    const sortBy = searchParams.get("sortBy") || "termYear";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const validSearchFields = ["studentId", "fullName", "cohort", "position", "remarks", "termYear"];
    const where: Record<string, unknown> = { deletedAt: null };
    Object.assign(where, parseFacetFilters(searchParams, FACET_FIELDS["graduate-committee"]));

    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      if (searchField && validSearchFields.includes(searchField)) {
        if (searchField === "termYear") {
          andConditions.push({ [searchField]: Number(search) || undefined });
        } else {
          andConditions.push({ [searchField]: { contains: search, mode: "insensitive" } });
        }
      } else {
        andConditions.push({
          OR: [
            { studentId: { contains: search, mode: "insensitive" } },
            { fullName: { contains: search, mode: "insensitive" } },
            { position: { contains: search, mode: "insensitive" } },
            { remarks: { contains: search, mode: "insensitive" } },
          ],
        });
      }
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [committees, total] = await Promise.all([
      prisma.graduateCommittee.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.graduateCommittee.count({ where }),
    ]);

    return NextResponse.json({
      data: committees,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch graduate committees:", error);
    return NextResponse.json(
      { error: "Failed to fetch graduate committees" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const validated = committeeCreateSchema.parse(body);

    const committee = await prisma.graduateCommittee.create({
      data: {
        termYear: Number(validated.termYear),
        studentId: validated.studentId.trim(),
        fullName: validated.fullName.trim(),
        cohort: validated.cohort.trim(),
        position: validated.position.trim(),
        remarks: validated.remarks?.trim() || null,
        major: validated.major?.trim() || null,
      },
    });

    return NextResponse.json(committee, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("Failed to create graduate committee:", error);
    return NextResponse.json(
      { error: "Failed to create graduate committee" },
      { status: 500 }
    );
  }
}

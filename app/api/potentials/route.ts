import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { checkWritePermission } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const search = searchParams.get("search") || "";
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);
    const searchField = searchParams.get("searchField") || "";
    const sortBy = searchParams.get("sortBy") || "recordedYear";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const validSearchFields = ["studentId", "fullName", "career", "position", "recordedYear"];
    const where: Record<string, unknown> = {};

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
    const { studentId, fullName, career, position, recordedYear } = body;

    if (!studentId || !fullName || !career || !position || !recordedYear) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const potential = await prisma.potential.create({
      data: {
        studentId: studentId.trim(),
        fullName: fullName.trim(),
        career: career.trim(),
        position: position.trim(),
        recordedYear: Number(recordedYear),
      },
    });

    return NextResponse.json(potential, { status: 201 });
  } catch (error) {
    console.error("Failed to create potential:", error);
    return NextResponse.json(
      { error: "Failed to create potential" },
      { status: 500 }
    );
  }
}

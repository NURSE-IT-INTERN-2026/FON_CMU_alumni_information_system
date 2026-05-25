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
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const validSearchFields = ["studentId", "fullName", "associationName", "position", "recordedYear"];
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
          { associationName: { contains: search, mode: "insensitive" } },
          { position: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const [data, total] = await Promise.all([
      prisma.association.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.association.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch associations:", error);
    return NextResponse.json(
      { error: "Failed to fetch associations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const { studentId, fullName, associationName, position, recordedYear } = body;

    if (!studentId || !fullName || !associationName || !position || !recordedYear) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const item = await prisma.association.create({
      data: {
        studentId: studentId.trim(),
        fullName: fullName.trim(),
        associationName: associationName.trim(),
        position: position.trim(),
        recordedYear: Number(recordedYear),
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create association:", error);
    return NextResponse.json(
      { error: "Failed to create association" },
      { status: 500 }
    );
  }
}

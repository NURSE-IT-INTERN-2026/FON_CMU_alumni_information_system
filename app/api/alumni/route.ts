import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);
    const search = searchParams.get("search") || "";
    const degreeLevel = searchParams.get("degreeLevel") || "";
    const initialYearFrom = searchParams.get("initialYearFrom");
    const initialYearTo = searchParams.get("initialYearTo");
    const graduationYearFrom = searchParams.get("graduationYearFrom");
    const graduationYearTo = searchParams.get("graduationYearTo");
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "firstName",
      "lastName",
      "studentId",
      "initialYear",
      "graduationYear",
      "degreeLevel",
    ];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : "createdAt";
    const validSortOrder: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";

    const where: Prisma.AlumniWhereInput = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
        { currentWorkplace: { contains: search, mode: "insensitive" } },
      ];
    }

    if (degreeLevel) {
      where.degreeLevel = degreeLevel as Prisma.EnumDegreeLevelFilter["equals"];
    }

    if (initialYearFrom || initialYearTo) {
      where.initialYear = {
        ...(initialYearFrom && { gte: parseInt(initialYearFrom, 10) }),
        ...(initialYearTo && { lte: parseInt(initialYearTo, 10) }),
      };
    }

    if (graduationYearFrom || graduationYearTo) {
      where.graduationYear = {
        ...(graduationYearFrom && { gte: parseInt(graduationYearFrom, 10) }),
        ...(graduationYearTo && { lte: parseInt(graduationYearTo, 10) }),
      };
    }

    const [data, total] = await Promise.all([
      prisma.alumni.findMany({
        where,
        include: {
          awards: true,
        },
        orderBy: { [validSortField]: validSortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.alumni.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("GET /api/alumni error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentId,
      firstName,
      lastName,
      degreeLevel,
      initialYear,
      graduationYear,
      email,
      phone,
      currentWorkplace,
      country,
      isPotential,
      isModelRepresentative,
      expertise,
      achievementSummary,
      photoUrl,
    } = body;

    if (!studentId || !firstName || !lastName || !degreeLevel || !initialYear || !graduationYear) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const existing = await prisma.alumni.findUnique({ where: { studentId } });
    if (existing) {
      return NextResponse.json(
        { error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" },
        { status: 409 }
      );
    }

    const alumni = await prisma.alumni.create({
      data: {
        studentId,
        firstName,
        lastName,
        degreeLevel,
        initialYear: parseInt(String(initialYear), 10),
        graduationYear: parseInt(String(graduationYear), 10),
        email: email || null,
        phone: phone || null,
        currentWorkplace: currentWorkplace || null,
        country: country || null,
        isPotential: isPotential ?? false,
        isModelRepresentative: isModelRepresentative ?? false,
        expertise: expertise || null,
        achievementSummary: achievementSummary || null,
        photoUrl: photoUrl || null,
      },
      include: {
        awards: true,
      },
    });

    return NextResponse.json(alumni, { status: 201 });
  } catch (error) {
    console.error("POST /api/alumni error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

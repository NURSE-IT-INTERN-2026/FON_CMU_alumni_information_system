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
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "firstName",
      "maidenLastName",
      "newLastName",
      "studentId",
      "cohort",
    ];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : "createdAt";
    const validSortOrder: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";

    const where: Prisma.AlumniWhereInput = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { maidenLastName: { contains: search, mode: "insensitive" } },
        { newLastName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
        { currentWorkplace: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.alumni.findMany({
        where,
        include: {
          awards: true,
          associations: true,
          graduateCommittees: true,
          potentials: true,
          modelRepresentatives: true,
          abroadAlumni: true,
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
      prefix,
      firstName,
      maidenLastName,
      cohort,
      newLastName,
      province,
      email,
      phone,
      currentWorkplace,
      country,
      isPotential,
      isModelRepresentative,
      photoUrl,
    } = body;

    if (!studentId || !prefix || !firstName || !maidenLastName) {
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
        prefix,
        firstName,
        maidenLastName,
        cohort: cohort || null,
        newLastName: newLastName || null,
        province: province || null,
        email: email || null,
        phone: phone || null,
        currentWorkplace: currentWorkplace || null,
        country: country || null,
        isPotential: isPotential ?? false,
        isModelRepresentative: isModelRepresentative ?? false,
        photoUrl: photoUrl || null,
      },
      include: {
        awards: true,
        associations: true,
        graduateCommittees: true,
        potentials: true,
        modelRepresentatives: true,
        abroadAlumni: true,
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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma, DegreeLevel } from "@/app/generated/prisma/client";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";
import { handleZodError, alumniCreateSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);
    const search = searchParams.get("search") || "";
    const degreeLevel = searchParams.get("degreeLevel") || "";
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "firstName",
      "maidenLastName",
      "newLastName",
      "studentId",
      "cohort",
      "prefix",
      "degreeLevel",
      "province",
    ];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : "createdAt";
    const validSortOrder: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";

    const where: Prisma.AlumniWhereInput = {
      ...(includeDeleted ? {} : { deletedAt: null }),
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { maidenLastName: { contains: search, mode: "insensitive" } },
        { newLastName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
        { currentWorkplace: { contains: search, mode: "insensitive" } },
      ];
    }

    if (degreeLevel && Object.values(DegreeLevel).includes(degreeLevel as DegreeLevel)) {
      where.degreeLevel = degreeLevel as DegreeLevel;
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
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const validated = alumniCreateSchema.parse(body);

    const existing = await prisma.alumni.findUnique({ where: { studentId: validated.studentId } });
    if (existing) {
      // If record exists and is already soft-deleted, just return it
      if (existing.deletedAt) {
        return NextResponse.json(existing, { status: 200 });
      }
      return NextResponse.json(
        { error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" },
        { status: 409 }
      );
    }

    const alumni = await prisma.alumni.create({
      data: {
        studentId: validated.studentId,
        prefix: validated.prefix,
        firstName: validated.firstName,
        maidenLastName: validated.maidenLastName,
        cohort: validated.cohort || null,
        degreeLevel: validated.degreeLevel,
        newLastName: validated.newLastName || null,
        province: validated.province || null,
        email: validated.email || null,
        phone: validated.phone || null,
        currentWorkplace: validated.currentWorkplace || null,
        country: validated.country || null,
        isPotential: validated.isPotential,
        isModelRepresentative: validated.isModelRepresentative,
        photoUrl: validated.photoUrl || null,
        deletedAt: validated.softDelete ? new Date() : null,
      },
      include: {
        awards: true,
        associations: true,
        graduateCommittees: true,
        potentials: true,
        modelRepresentatives: true,
      },
    });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "CREATE",
        "alumni",
        alumni.id,
        { studentId: alumni.studentId, name: `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}` },
        getIp(request)
      );
    }

    return NextResponse.json(alumni, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/alumni error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

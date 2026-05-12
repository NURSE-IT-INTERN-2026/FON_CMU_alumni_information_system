import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEGREE_LABELS } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const degreeLevel = searchParams.get("degreeLevel") || "";
    const initialYearFrom = searchParams.get("initialYearFrom");
    const initialYearTo = searchParams.get("initialYearTo");
    const graduationYearFrom = searchParams.get("graduationYearFrom");
    const graduationYearTo = searchParams.get("graduationYearTo");

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

    const alumni = await prisma.alumni.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const rows = alumni.map((a) => ({
      "รหัสนักศึกษา": a.studentId,
      "ชื่อ": a.firstName,
      "นามสกุล": a.lastName,
      "ระดับปริญญา": DEGREE_LABELS[a.degreeLevel] || a.degreeLevel,
      "ปีที่เข้าศึกษา": a.initialYear,
      "ปีที่จบ": a.graduationYear,
      "อีเมล": a.email || "",
      "เบอร์โทร": a.phone || "",
      "สถานที่ทำงาน": a.currentWorkplace || "",
      "ประเทศ": a.country || "",
      "ศักยภาพ": a.isPotential ? "ใช่" : "ไม่ใช่",
      "ศิษย์เก่าแบบอย่าง": a.isModelRepresentative ? "ใช่" : "ไม่ใช่",
      "ความเชี่ยวชาญ": a.expertise || "",
      "สรุปผลงาน": a.achievementSummary || "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "ศิษย์เก่า");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="alumni_export_${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/alumni/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

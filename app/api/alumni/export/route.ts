import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { buildExcelResponse } from "@/lib/excel-export";

const MAX_EXPORT_COUNT = 10000;

const DEGREE_LEVEL_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
};

function mapRows(alumni: Awaited<ReturnType<typeof prisma.alumni.findMany>>) {
  return alumni.map((a) => ({
    "รหัสนักศึกษา": a.studentId,
    "คำนำหน้า": a.prefix,
    "ชื่อ": a.firstName,
    "นามสกุลเดิม": a.maidenLastName,
    "รุ่น/สาขา": a.cohort || "",
    "ระดับการศึกษา": a.degreeLevel ? DEGREE_LEVEL_LABELS[a.degreeLevel] || a.degreeLevel : "",
    "นามสกุลใหม่": a.newLastName || "",
    "จังหวัด": a.province || "",
    "อีเมล": a.email || "",
    "เบอร์โทร": a.phone || "",
    "สถานที่ทำงาน": a.currentWorkplace || "",
    "ประเทศ": a.country || "",
    "ศักยภาพ": a.isPotential ? "ใช่" : "ไม่ใช่",
    "ผู้แทนรุ่น": a.isModelRepresentative ? "ใช่" : "ไม่ใช่",
  }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";

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

    const alumni = await prisma.alumni.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return buildExcelResponse(mapRows(alumni), "ศิษย์เก่า", "alumni_export");
  } catch (error) {
    console.error("GET /api/alumni/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเลือกรายการที่ต้องการส่งออก" },
        { status: 400 }
      );
    }
    if (ids.length > MAX_EXPORT_COUNT) {
      return NextResponse.json(
        { error: `ส่งออกได้สูงสุด ${MAX_EXPORT_COUNT} รายการ` },
        { status: 400 }
      );
    }

    const alumni = await prisma.alumni.findMany({
      where: { id: { in: ids } },
    });

    return buildExcelResponse(mapRows(alumni), "ศิษย์เก่า", "alumni_export");
  } catch (error) {
    console.error("POST /api/alumni/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

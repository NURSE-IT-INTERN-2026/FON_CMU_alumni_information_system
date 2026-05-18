import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  try {
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

    const rows = alumni.map((a) => ({
      "รหัสนักศึกษา": a.studentId,
      "คำนำหน้า": a.prefix,
      "ชื่อ": a.firstName,
      "นามสกุลเดิม": a.maidenLastName,
      "รุ่น/สาขา": a.cohort || "",
      "นามสกุลใหม่": a.newLastName || "",
      "จังหวัด": a.province || "",
      "อีเมล": a.email || "",
      "เบอร์โทร": a.phone || "",
      "สถานที่ทำงาน": a.currentWorkplace || "",
      "ประเทศ": a.country || "",
      "ศักยภาพ": a.isPotential ? "ใช่" : "ไม่ใช่",
      "ผู้แทนรุ่น": a.isModelRepresentative ? "ใช่" : "ไม่ใช่",
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

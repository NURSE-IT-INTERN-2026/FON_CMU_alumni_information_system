import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const cohort = searchParams.get("cohort") || "";
    const position = searchParams.get("position") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { studentId: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { remarks: { contains: search, mode: "insensitive" } },
      ];
    }
    if (cohort) where.cohort = cohort;
    if (position) where.position = position;

    const items = await prisma.graduateCommittee.findMany({
      where,
      orderBy: [{ termYear: "desc" }, { createdAt: "desc" }],
    });

    const rows = items.map((a) => ({
      "ปี พ.ศ.": a.termYear,
      "รหัสนักศึกษา": a.studentId,
      "ชื่อ-สกุล": a.fullName,
      "รุ่นที่": a.cohort,
      "ตำแหน่ง": a.position,
      "หมายเหตุ": a.remarks || "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "กรรมการบัณฑิต");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="graduate_committee_export_${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/graduate-committee/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

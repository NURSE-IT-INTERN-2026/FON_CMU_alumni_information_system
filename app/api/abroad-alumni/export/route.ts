import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { thaiName: { contains: search, mode: "insensitive" } },
        { englishName: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
        { workplace: { contains: search, mode: "insensitive" } },
        { cohort: { contains: search, mode: "insensitive" } },
      ];
    }

    const items = await prisma.abroadAlumni.findMany({
      where,
      orderBy: [{ country: "asc" }, { order: "asc" }],
    });

    const rows = items.map((a) => ({
      "รุ่น": a.cohort || "",
      "คำนำหน้า": a.prefix || "",
      "ชื่อไทย": a.thaiName || "",
      "ชื่ออังกฤษ": a.englishName || "",
      "สถานที่ทำงาน": a.workplace || "",
      "ประเทศ": a.country,
      "หมายเหตุ": a.notes || "",
      "ลำดับ": a.order,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "ข้อมูลการทำงานต่างประเทศ");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="abroad_alumni_export_${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/abroad-alumni/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

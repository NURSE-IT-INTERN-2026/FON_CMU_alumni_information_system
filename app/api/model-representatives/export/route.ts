import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const items = await prisma.modelRepresentative.findMany({
      orderBy: [{ cohort: "asc" }, { generation: "asc" }],
    });

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId,
      "ชื่อ-นามสกุล": a.name,
      "รุ่น": a.cohort,
      "ลำดับรุ่น": a.generation,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "ผู้แทนรุ่น");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="model_representatives_export_${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/model-representatives/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AWARD_TYPE_LABELS } from "@/lib/constants";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const awardType = searchParams.get("awardType") || "";

    const where: Record<string, unknown> = {};
    if (search || awardType) {
      where.AND = [];
      if (search) {
        (where.AND as Record<string, unknown>[]).push({
          OR: [
            { awardName: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { alumni: { firstName: { contains: search, mode: "insensitive" } } },
            { alumni: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        });
      }
      if (awardType) {
        (where.AND as Record<string, unknown>[]).push({ awardType });
      }
    }

    const items = await prisma.award.findMany({
      where,
      include: { alumni: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const rows = items.map((a) => ({
      "ชื่อ": a.alumni.firstName,
      "นามสกุล": a.alumni.lastName,
      "ชื่อรางวัล": a.awardName,
      "ประเภทรางวัล": AWARD_TYPE_LABELS[a.awardType] || a.awardType,
      "ปี (พ.ศ.)": a.year,
      "รายละเอียด": a.description || "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "รางวัล");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="awards_export_${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/awards/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

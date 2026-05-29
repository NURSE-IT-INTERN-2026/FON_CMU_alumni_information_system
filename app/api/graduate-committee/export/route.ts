import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

function buildResponse(rows: Record<string, unknown>[], filename: string) {
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
      "Content-Disposition": `attachment; filename="${filename}_${dateStr}.xlsx"`,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const cohort = searchParams.get("cohort") || "";
    const position = searchParams.get("position") || "";
    const searchField = searchParams.get("searchField") || "";
    const sortBy = searchParams.get("sortBy") || "termYear";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const validSortFields = ["termYear", "createdAt", "studentId", "fullName", "cohort", "position"];
    const validSortField = validSortFields.includes(sortBy) ? sortBy : "termYear";

    const validSearchFields = ["studentId", "fullName", "cohort", "position", "remarks", "termYear"];
    const where: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      if (searchField && validSearchFields.includes(searchField)) {
        if (searchField === "termYear") {
          andConditions.push({ [searchField]: Number(search) || undefined });
        } else {
          andConditions.push({ [searchField]: { contains: search, mode: "insensitive" } });
        }
      } else {
        andConditions.push({
          OR: [
            { studentId: { contains: search, mode: "insensitive" } },
            { fullName: { contains: search, mode: "insensitive" } },
            { remarks: { contains: search, mode: "insensitive" } },
          ],
        });
      }
    }

    if (cohort) andConditions.push({ cohort });
    if (position) andConditions.push({ position });

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const items = await prisma.graduateCommittee.findMany({
      where,
      orderBy: { [validSortField]: sortOrder },
    });

    const rows = items.map((a) => ({
      "ปี พ.ศ.": a.termYear,
      "รหัสนักศึกษา": a.studentId,
      "ชื่อ-สกุล": a.fullName,
      "รุ่นที่": a.cohort,
      "ตำแหน่ง": a.position,
      "หมายเหตุ": a.remarks || "",
    }));

    return buildResponse(rows, "graduate_committee_export");
  } catch (error) {
    console.error("GET /api/graduate-committee/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเลือกรายการที่ต้องการส่งออก" },
        { status: 400 }
      );
    }

    const items = await prisma.graduateCommittee.findMany({
      where: { id: { in: ids } },
    });

    const rows = items.map((a) => ({
      "ปี พ.ศ.": a.termYear,
      "รหัสนักศึกษา": a.studentId,
      "ชื่อ-สกุล": a.fullName,
      "รุ่นที่": a.cohort,
      "ตำแหน่ง": a.position,
      "หมายเหตุ": a.remarks || "",
    }));

    return buildResponse(rows, "graduate_committee_export");
  } catch (error) {
    console.error("POST /api/graduate-committee/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

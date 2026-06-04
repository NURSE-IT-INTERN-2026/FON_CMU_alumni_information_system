import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

const MAX_EXPORT_COUNT = 10000;

function buildResponse(rows: Record<string, unknown>[], filename: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "ศักยภาพ");

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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const searchField = searchParams.get("searchField") || "";
    const sortBy = searchParams.get("sortBy") || "recordedYear";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const validSortFields = ["createdAt", "studentId", "fullName", "career", "position", "recordedYear"];
    const validSortField = validSortFields.includes(sortBy) ? sortBy : "recordedYear";

    const validSearchFields = ["studentId", "fullName", "career", "position", "recordedYear"];
    const where: Record<string, unknown> = {};

    if (search) {
      if (searchField && validSearchFields.includes(searchField)) {
        if (searchField === "recordedYear") {
          where[searchField] = Number(search) || undefined;
        } else {
          where[searchField] = { contains: search, mode: "insensitive" };
        }
      } else {
        where.OR = [
          { studentId: { contains: search, mode: "insensitive" } },
          { fullName: { contains: search, mode: "insensitive" } },
          { career: { contains: search, mode: "insensitive" } },
          { position: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const items = await prisma.potential.findMany({
      where,
      orderBy: { [validSortField]: sortOrder },
    });

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId,
      "ชื่อ-สกุล": a.fullName,
      "อาชีพ": a.career,
      "ตำแหน่ง": a.position,
      "ปีที่บันทึก (พ.ศ.)": a.recordedYear,
    }));

    return buildResponse(rows, "potentials_export");
  } catch (error) {
    console.error("GET /api/potentials/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
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

    const items = await prisma.potential.findMany({
      where: { id: { in: ids } },
    });

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId,
      "ชื่อ-สกุล": a.fullName,
      "อาชีพ": a.career,
      "ตำแหน่ง": a.position,
      "ปีที่บันทึก (พ.ศ.)": a.recordedYear,
    }));

    return buildResponse(rows, "potentials_export");
  } catch (error) {
    console.error("POST /api/potentials/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

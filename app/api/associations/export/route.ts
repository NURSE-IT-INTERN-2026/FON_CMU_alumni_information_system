import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildExcelResponse } from "@/lib/excel-export";

const MAX_EXPORT_COUNT = 10000;

const NAME_ROW = (a: { prefix: string | null; firstName: string | null; lastName: string | null }) => ({
  "คำนำหน้า": a.prefix ?? "",
  "ชื่อ": a.firstName ?? "",
  "นามสกุล": a.lastName ?? "",
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const searchField = searchParams.get("searchField") || "";
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const validSortFields = ["createdAt", "studentId", "prefix", "firstName", "lastName", "associationName", "position", "recordedYear"];
    const validSortField = validSortFields.includes(sortField) ? sortField : "createdAt";

    const validSearchFields = ["studentId", "name", "firstName", "lastName", "associationName", "position", "recordedYear"];
    const where: Record<string, unknown> = {};

    if (search) {
      if (searchField && validSearchFields.includes(searchField)) {
        if (searchField === "recordedYear") {
          where[searchField] = Number(search) || undefined;
        } else if (searchField === "name") {
          where.OR = [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ];
        } else {
          where[searchField] = { contains: search, mode: "insensitive" };
        }
      } else {
        where.OR = [
          { studentId: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { associationName: { contains: search, mode: "insensitive" } },
          { position: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const items = await prisma.association.findMany({
      where,
      orderBy: { [validSortField]: sortOrder },
    });

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId,
      ...NAME_ROW(a),
      "สาขาวิชา": a.major || "",
      "ชื่อสมาคม/ชมรม": a.associationName,
      "ตำแหน่ง": a.position,
      "ปีที่บันทึก (พ.ศ.)": a.recordedYear,
    }));

    return buildExcelResponse(rows, "สมาคม/ชมรม", "associations_export");
  } catch (error) {
    console.error("GET /api/associations/export error:", error);
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

    const items = await prisma.association.findMany({
      where: { id: { in: ids } },
    });

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId,
      ...NAME_ROW(a),
      "สาขาวิชา": a.major || "",
      "ชื่อสมาคม/ชมรม": a.associationName,
      "ตำแหน่ง": a.position,
      "ปีที่บันทึก (พ.ศ.)": a.recordedYear,
    }));

    return buildExcelResponse(rows, "สมาคม/ชมรม", "associations_export");
  } catch (error) {
    console.error("POST /api/associations/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildExcelResponse } from "@/lib/excel-export";

const MAX_EXPORT_COUNT = 10000;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { studentId: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { cohort: { contains: search, mode: "insensitive" } },
      ];
    }

    const items = await prisma.modelRepresentative.findMany({
      where,
      orderBy: [{ cohort: "asc" }, { generation: "asc" }],
    });

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId,
      "ชื่อ-นามสกุล": a.name,
      "เครือข่าย": a.cohort,
      "ลำดับรุ่น": a.generation,
    }));

    return buildExcelResponse(rows, "ผู้แทนรุ่น", "model_representatives_export");
  } catch (error) {
    console.error("GET /api/model-representatives/export error:", error);
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

    const items = await prisma.modelRepresentative.findMany({
      where: { id: { in: ids } },
    });

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId,
      "ชื่อ-นามสกุล": a.name,
      "เครือข่าย": a.cohort,
      "ลำดับรุ่น": a.generation,
    }));

    return buildExcelResponse(rows, "ผู้แทนรุ่น", "model_representatives_export");
  } catch (error) {
    console.error("POST /api/model-representatives/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

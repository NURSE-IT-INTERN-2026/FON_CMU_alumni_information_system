import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

const MAX_EXPORT_COUNT = 10000;

function buildResponse(rows: Record<string, unknown>[], filename: string) {
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
    const country = searchParams.get("country") || "";
    const searchFieldParam = searchParams.get("searchField") || "all";

    const validSearchFields = ["thaiName", "englishName", "country", "workplace", "cohort"];
    const where: Record<string, unknown> = {};

    if (country) {
      where.country = country;
    }

    if (search) {
      if (searchFieldParam && validSearchFields.includes(searchFieldParam)) {
        where[searchFieldParam] = { contains: search, mode: "insensitive" };
      } else {
        where.OR = [
          { thaiName: { contains: search, mode: "insensitive" } },
          { englishName: { contains: search, mode: "insensitive" } },
          { country: { contains: search, mode: "insensitive" } },
          { workplace: { contains: search, mode: "insensitive" } },
          { cohort: { contains: search, mode: "insensitive" } },
        ];
      }
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
      "ที่อยู่บ้าน": a.homeAddress || "",
      "ประเทศ": a.country,
      "หมายเหตุ": a.notes || "",
      "ลำดับ": a.order,
    }));

    return buildResponse(rows, "abroad_alumni_export");
  } catch (error) {
    console.error("GET /api/abroad-alumni/export error:", error);
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

    const items = await prisma.abroadAlumni.findMany({
      where: { id: { in: ids } },
    });

    const rows = items.map((a) => ({
      "รุ่น": a.cohort || "",
      "คำนำหน้า": a.prefix || "",
      "ชื่อไทย": a.thaiName || "",
      "ชื่ออังกฤษ": a.englishName || "",
      "สถานที่ทำงาน": a.workplace || "",
      "ที่อยู่บ้าน": a.homeAddress || "",
      "ประเทศ": a.country,
      "หมายเหตุ": a.notes || "",
      "ลำดับ": a.order,
    }));

    return buildResponse(rows, "abroad_alumni_export");
  } catch (error) {
    console.error("POST /api/abroad-alumni/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

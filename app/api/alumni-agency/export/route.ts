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

    const items = await prisma.alumniAgency.findMany({
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

    return buildExcelResponse(rows, "ต้นสังกัดศิษย์เก่า", "alumni_agency_export");
  } catch (error) {
    console.error("GET /api/alumni-agency/export error:", error);
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

    const items = await prisma.alumniAgency.findMany({
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

    return buildExcelResponse(rows, "ต้นสังกัดศิษย์เก่า", "alumni_agency_export");
  } catch (error) {
    console.error("POST /api/alumni-agency/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

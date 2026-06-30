import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { buildExcelResponse } from "@/lib/excel-export";
import { THAILAND_COUNTRY_VALUES } from "@/lib/alumni-agency-region";

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

    // Mirror the GET list's region split (PRD §3.9) so an abroad export never
    // includes Thailand-valued records and vice versa.
    const region = searchParams.get("region");
    const thailandCountryFilter = {
      country: { in: [...THAILAND_COUNTRY_VALUES], mode: "insensitive" as const },
    };

    const validSearchFields = ["studentId", "major", "firstName", "lastName", "englishName", "country", "workplace", "cohort"];
    const where: Record<string, unknown> = {};

    if (region === "thailand") {
      Object.assign(where, thailandCountryFilter);
    } else if (region === "abroad") {
      where.NOT = thailandCountryFilter;
    }

    if (country) {
      where.country = country;
    }

    if (search) {
      if (searchFieldParam && validSearchFields.includes(searchFieldParam)) {
        where[searchFieldParam] = { contains: search, mode: "insensitive" };
      } else {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
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
    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "alumni_agency",
      null,
      { count: items.length, mode: "filtered", search: search || undefined },
    );

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId || a.pendingStudentId || "",
      "รุ่น": a.cohort || "",
      "คำนำหน้า": a.prefix || "",
      "ชื่อ": a.firstName || "",
      "นามสกุล": a.lastName || "",
      "ชื่ออังกฤษ": a.englishName || "",
      "สาขาวิชา": a.major || "",
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
    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "alumni_agency",
      null,
      { count: items.length, mode: "selected" },
    );

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId || a.pendingStudentId || "",
      "รุ่น": a.cohort || "",
      "คำนำหน้า": a.prefix || "",
      "ชื่อ": a.firstName || "",
      "นามสกุล": a.lastName || "",
      "ชื่ออังกฤษ": a.englishName || "",
      "สาขาวิชา": a.major || "",
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

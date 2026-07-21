import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { buildExcelResponse, resolveRowRange } from "@/lib/excel-export";
import { joinPhones } from "@/lib/parse-phone";
import { formatBirthDateThai } from "@/lib/alumni-verify";
import { DEGREE_LEVEL_OPTIONS } from "@/lib/constants";

const MAX_EXPORT_COUNT = 10000;

/** Thai display labels for degree-level enum values — same source as the
 * all-alumni table (lib/constants.ts DEGREE_LEVEL_OPTIONS), so the export
 * label set can never drift from what's shown on screen. */
const DEGREE_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  DEGREE_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
);

function mapRows(alumni: Awaited<ReturnType<typeof prisma.alumni.findMany>>) {
  // Columns mirror the on-screen all-alumni table
  // (app/(admin)/management/all-alumni/page.tsx), same order and value
  // rendering, minus the UI-only ลำดับ (row number) + จัดการ (actions).
  // buildExcelResponse derives columns from Object.keys(rows[0]), so the key
  // set below IS the exported column set.
  return alumni.map((a) => ({
    "รหัสนักศึกษา": a.studentId,
    "รุ่น": a.cohort || "",
    "คำนำหน้า": a.prefix,
    "ชื่อ": a.firstName,
    "นามสกุล": a.lastName,
    "ระดับการศึกษา": a.degreeLevel ? DEGREE_LEVEL_LABELS[a.degreeLevel] ?? a.degreeLevel : "",
    "สาขาวิชา": a.major || "",
    "ปีสำเร็จการศึกษา": a.graduationYear ?? "",
    "วันเกิด": formatBirthDateThai(a.birthDate) ?? "",
    "อีเมลติดต่อ": a.contactEmail || a.email || "",
    "เบอร์โทร": joinPhones(a.phones),
    "หมายเหตุ": a.remarks || "",
  }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const startRow = searchParams.get("startRow");
    const endRow = searchParams.get("endRow");

    const where: Prisma.AlumniWhereInput = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
      ];
    }

    const alumni = await prisma.alumni.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const { start, end } = resolveRowRange(startRow, endRow, alumni.length);
    const rows = mapRows(alumni.slice(start - 1, end));
    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "alumni",
      null,
      { count: rows.length, mode: "filtered", search: search || undefined, range: { start, end, total: alumni.length } },
    );

    return buildExcelResponse(rows, "ศิษย์เก่า", "alumni_export");
  } catch (error) {
    console.error("GET /api/alumni/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูลศิษย์เก่า" },
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

    const alumni = await prisma.alumni.findMany({
      where: { id: { in: ids } },
    });

    const rows = mapRows(alumni);
    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "alumni",
      null,
      { count: rows.length, mode: "selected" },
    );

    return buildExcelResponse(rows, "ศิษย์เก่า", "alumni_export");
  } catch (error) {
    console.error("POST /api/alumni/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

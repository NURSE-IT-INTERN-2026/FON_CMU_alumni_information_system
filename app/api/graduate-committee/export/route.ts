import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
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
    const cohort = searchParams.get("cohort") || "";
    const position = searchParams.get("position") || "";
    const searchField = searchParams.get("searchField") || "";
    const sortBy = searchParams.get("sortBy") || "termYear";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const validSortFields = ["termYear", "createdAt", "studentId", "prefix", "firstName", "lastName", "cohort", "position"];
    const validSortField = validSortFields.includes(sortBy) ? sortBy : "termYear";

    const validSearchFields = ["studentId", "name", "firstName", "lastName", "cohort", "position", "remarks", "termYear"];
    const where: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      if (searchField && validSearchFields.includes(searchField)) {
        if (searchField === "termYear") {
          andConditions.push({ [searchField]: Number(search) || undefined });
        } else if (searchField === "name") {
          andConditions.push({
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          });
        } else {
          andConditions.push({ [searchField]: { contains: search, mode: "insensitive" } });
        }
      } else {
        andConditions.push({
          OR: [
            { studentId: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
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
    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "graduate_committee",
      null,
      { count: items.length, mode: "filtered", search: search || undefined },
    );

    const rows = items.map((a) => ({
      "ปี พ.ศ.": a.termYear,
      "รหัสนักศึกษา": a.studentId || a.pendingStudentId || "",
      ...NAME_ROW(a),
      "สาขาวิชา": a.major || "",
      "รุ่นที่": a.cohort,
      "ตำแหน่ง": a.position,
      "หมายเหตุ": a.remarks || "",
    }));

    return buildExcelResponse(rows, "กรรมการบัณฑิต", "graduate_committee_export");
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

    const items = await prisma.graduateCommittee.findMany({
      where: { id: { in: ids } },
    });
    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "graduate_committee",
      null,
      { count: items.length, mode: "selected" },
    );

    const rows = items.map((a) => ({
      "ปี พ.ศ.": a.termYear,
      "รหัสนักศึกษา": a.studentId || a.pendingStudentId || "",
      ...NAME_ROW(a),
      "สาขาวิชา": a.major || "",
      "รุ่นที่": a.cohort,
      "ตำแหน่ง": a.position,
      "หมายเหตุ": a.remarks || "",
    }));

    return buildExcelResponse(rows, "กรรมการบัณฑิต", "graduate_committee_export");
  } catch (error) {
    console.error("POST /api/graduate-committee/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

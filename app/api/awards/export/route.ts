import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AWARD_TYPE_LABELS } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";
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
    const awardType = searchParams.get("awardType") || "";
    const searchFieldParam = searchParams.get("searchField") || "all";
    const sortField = searchParams.get("sortField") || "year";
    const sortDir = searchParams.get("sortDir") || "desc";

    const validSearchFields = ["awardName", "firstName", "lastName", "description", "name", "year"];

    const where: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      if (searchFieldParam && validSearchFields.includes(searchFieldParam)) {
        if (searchFieldParam === "year") {
          andConditions.push({ year: Number(search) || undefined });
        } else if (searchFieldParam === "name") {
          andConditions.push({
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { alumni: { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }] } },
            ],
          });
        } else {
          andConditions.push({ [searchFieldParam]: { contains: search, mode: "insensitive" } });
        }
      } else {
        andConditions.push({
          OR: [
            { awardName: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { alumni: { firstName: { contains: search, mode: "insensitive" } } },
            { alumni: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        });
      }
    }

    if (awardType) {
      andConditions.push({ awardType });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const sortFieldMap: Record<string, string> = { name: "firstName", award: "awardName", type: "awardType", year: "year", major: "major", description: "description", studentId: "studentId", prefix: "prefix", lastName: "lastName" };
    const orderKey = sortFieldMap[sortField] || "year";
    const dir = sortDir === "asc" ? "asc" : "desc";

    const items = await prisma.award.findMany({
      where,
      orderBy: { [orderKey]: dir },
    });
    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "award",
      null,
      { count: items.length, mode: "filtered", search: search || undefined },
      getIp(request),
    );

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId ?? "",
      "คำนำหน้า": a.prefix ?? "",
      "ชื่อ": a.firstName ?? "",
      "นามสกุล": a.lastName ?? "",
      "สาขาวิชา": a.major || "",
      "ชื่อรางวัล": a.awardName,
      "ประเภทรางวัล": AWARD_TYPE_LABELS[a.awardType] || a.awardType,
      "ปี (พ.ศ.)": a.year,
      "ลิงค์": a.link || "",
      "รูปภาพ": a.imageUrl || "",
      "รายละเอียด": a.description || "",
    }));

    return buildExcelResponse(rows, "รางวัล", "awards_export");
  } catch (error) {
    console.error("GET /api/awards/export error:", error);
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

    const items = await prisma.award.findMany({
      where: { id: { in: ids } },
    });
    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "award",
      null,
      { count: items.length, mode: "selected" },
      getIp(request),
    );

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.studentId ?? "",
      "คำนำหน้า": a.prefix ?? "",
      "ชื่อ": a.firstName ?? "",
      "นามสกุล": a.lastName ?? "",
      "สาขาวิชา": a.major || "",
      "ชื่อรางวัล": a.awardName,
      "ประเภทรางวัล": AWARD_TYPE_LABELS[a.awardType] || a.awardType,
      "ปี (พ.ศ.)": a.year,
      "ลิงค์": a.link || "",
      "รูปภาพ": a.imageUrl || "",
      "รายละเอียด": a.description || "",
    }));

    return buildExcelResponse(rows, "รางวัล", "awards_export");
  } catch (error) {
    console.error("POST /api/awards/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

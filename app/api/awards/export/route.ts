import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AWARD_TYPE_LABELS } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

const MAX_EXPORT_COUNT = 10000;

function buildResponse(rows: Record<string, unknown>[], filename: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "รางวัล");

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
    const awardType = searchParams.get("awardType") || "";
    const searchFieldParam = searchParams.get("searchField") || "all";
    const sortField = searchParams.get("sortField") || "year";
    const sortDir = searchParams.get("sortDir") || "desc";

    const validSearchFields = ["awardName", "recipientName", "description", "name", "year"];

    const where: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      if (searchFieldParam && validSearchFields.includes(searchFieldParam)) {
        if (searchFieldParam === "year") {
          andConditions.push({ year: Number(search) || undefined });
        } else if (searchFieldParam === "name") {
          andConditions.push({
            OR: [
              { recipientName: { contains: search, mode: "insensitive" } },
              { alumni: { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { maidenLastName: { contains: search, mode: "insensitive" } }] } },
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
            { recipientName: { contains: search, mode: "insensitive" } },
            { alumni: { firstName: { contains: search, mode: "insensitive" } } },
            { alumni: { maidenLastName: { contains: search, mode: "insensitive" } } },
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

    const sortFieldMap: Record<string, string> = { name: "recipientName", award: "awardName", type: "awardType", year: "year" };
    const orderKey = sortFieldMap[sortField] || "year";
    const dir = sortDir === "asc" ? "asc" : "desc";

    const items = await prisma.award.findMany({
      where,
      include: { alumni: { select: { studentId: true, prefix: true, firstName: true, maidenLastName: true } } },
      orderBy: { [orderKey]: dir },
    });

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.alumni?.studentId ?? "",
      "คำนำหน้า": a.alumni?.prefix ?? "",
      "ชื่อ": a.alumni?.firstName ?? a.recipientName ?? "",
      "นามสกุลเดิม": a.alumni?.maidenLastName ?? "",
      "ชื่อรางวัล": a.awardName,
      "ประเภทรางวัล": AWARD_TYPE_LABELS[a.awardType] || a.awardType,
      "ปี (พ.ศ.)": a.year,
      "รายละเอียด": a.description || "",
    }));

    return buildResponse(rows, "awards_export");
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
      include: { alumni: { select: { studentId: true, prefix: true, firstName: true, maidenLastName: true } } },
    });

    const rows = items.map((a) => ({
      "รหัสนักศึกษา": a.alumni?.studentId ?? "",
      "คำนำหน้า": a.alumni?.prefix ?? "",
      "ชื่อ": a.alumni?.firstName ?? a.recipientName ?? "",
      "นามสกุลเดิม": a.alumni?.maidenLastName ?? "",
      "ชื่อรางวัล": a.awardName,
      "ประเภทรางวัล": AWARD_TYPE_LABELS[a.awardType] || a.awardType,
      "ปี (พ.ศ.)": a.year,
      "รายละเอียด": a.description || "",
    }));

    return buildResponse(rows, "awards_export");
  } catch (error) {
    console.error("POST /api/awards/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูล" },
      { status: 500 }
    );
  }
}

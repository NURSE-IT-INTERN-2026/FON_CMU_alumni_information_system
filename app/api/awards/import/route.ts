import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { AWARD_TYPE_LABELS } from "@/lib/constants";
import { AwardType } from "@/app/generated/prisma/client";
import * as XLSX from "xlsx";

const AWARD_TYPE_THAI_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.entries(AWARD_TYPE_LABELS).map(([key, value]) => [value, key])
);

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "กรุณาเลือกไฟล์ Excel" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);

    const errors: { row: number; message: string }[] = [];
    const records: { alumniId: string; awardName: string; awardType: AwardType; year: number; description?: string | null }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const firstName = row["ชื่อ"]?.toString().trim();
      const lastName = row["นามสกุล"]?.toString().trim();
      const awardName = row["ชื่อรางวัล"]?.toString().trim();
      const awardTypeThai = row["ประเภทรางวัล"]?.toString().trim();
      const yearStr = row["ปี (พ.ศ.)"]?.toString().trim();
      const description = row["รายละเอียด"]?.toString().trim() || null;

      if (!firstName || !lastName || !awardName || !awardTypeThai || !yearStr) {
        errors.push({ row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
        continue;
      }

      const awardType = AWARD_TYPE_THAI_TO_ENUM[awardTypeThai];
      if (!awardType) {
        errors.push({
          row: rowNumber,
          message: `ประเภทรางวัล "${awardTypeThai}" ไม่ถูกต้อง`,
        });
        continue;
      }

      const year = parseInt(yearStr, 10);
      if (isNaN(year)) {
        errors.push({ row: rowNumber, message: "ปี (พ.ศ.) ไม่ถูกต้อง" });
        continue;
      }

      const alumni = await prisma.alumni.findFirst({
        where: {
          firstName: { equals: firstName, mode: "insensitive" },
          lastName: { equals: lastName, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (!alumni) {
        errors.push({
          row: rowNumber,
          message: `ไม่พบข้อมูลศิษย์เก่าชื่อ "${firstName} ${lastName}"`,
        });
        continue;
      }

      records.push({
        alumniId: alumni.id,
        awardName,
        awardType: awardType as AwardType,
        year,
        description,
      });
    }

    let imported = 0;
    if (records.length > 0) {
      const result = await prisma.award.createMany({ data: records });
      imported = result.count;
    }

    return NextResponse.json({ imported, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/awards/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}

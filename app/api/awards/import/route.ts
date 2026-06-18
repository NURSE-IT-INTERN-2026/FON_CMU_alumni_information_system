import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { AwardType } from "@/app/generated/prisma/client";
import { ensureAlumni } from "@/lib/ensure-alumni";
import { checkWritePermission } from "@/lib/permissions";
import { readExcelRows } from "@/lib/excel-import";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

import { parseAwardRow } from "@/lib/award-import-parse";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
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

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      return NextResponse.json(
        { error: "ไฟล์มีขนาดเกิน 5MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await readExcelRows(buffer);

    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const { data, error } = parseAwardRow(rows[i], rowNumber);

      if (error) {
        errors.push(error);
        continue;
      }

      try {
        // Sync with CMU by studentId; copy the resolved major onto the row.
        let major: string | null = null;
        if (data!.studentId) {
          const alumni = await ensureAlumni(
            data!.studentId,
            data!.recipientName ?? data!.studentId,
          );
          major = alumni.major;
        }

        await prisma.award.create({
          data: {
            studentId: data!.studentId,
            recipientName: data!.recipientName,
            awardName: data!.awardName,
            awardType: data!.awardType as AwardType,
            year: data!.year,
            description: data!.description,
            major,
          },
        });
        imported++;
      } catch {
        errors.push({
          row: rowNumber,
          message: `ไม่สามารถนำเข้าข้อมูลแถวนี้ได้`,
        });
      }
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


import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureAlumni } from "@/lib/ensure-alumni";
import { checkWritePermission } from "@/lib/permissions";
import { readExcelRows } from "@/lib/excel-import";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
    const records: { studentId: string; fullName: string; associationName: string; position: string; recordedYear: number }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const studentId = row["รหัสนักศึกษา"]?.toString().trim();
      const fullName = row["ชื่อ-สกุล"]?.toString().trim();
      const associationName = row["ชื่อสมาคม/ชมรม"]?.toString().trim();
      const position = row["ตำแหน่ง"]?.toString().trim();
      const recordedYearStr = row["ปีที่บันทึก (พ.ศ.)"]?.toString().trim();

      if (!studentId || !fullName || !associationName || !position || !recordedYearStr) {
        errors.push({ row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
        continue;
      }

      const recordedYear = parseInt(recordedYearStr, 10);
      if (isNaN(recordedYear)) {
        errors.push({ row: rowNumber, message: "ปีที่บันทึกไม่ถูกต้อง" });
        continue;
      }

      records.push({ studentId, fullName, associationName, position, recordedYear });
    }

    let imported = 0;
    for (const record of records) {
      try {
        // Sync with CMU: ensureAlumni backfills the alumni record from the
        // Registrar API and returns it so we can copy `major` onto this row.
        const alumni = await ensureAlumni(record.studentId, record.fullName);
        await prisma.association.create({
          data: { ...record, major: alumni.major ?? null },
        });
        imported++;
      } catch (err) {
        console.error("Import row error:", err);
        errors.push({ row: -1, message: `ไม่สามารถนำเข้าข้อมูล ${record.fullName}: ${err instanceof Error ? err.message : "ข้อผิดพลาด"}` });
      }
    }

    return NextResponse.json({ imported, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/associations/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}

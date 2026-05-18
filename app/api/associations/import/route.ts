import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

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
    if (records.length > 0) {
      const result = await prisma.association.createMany({ data: records });
      imported = result.count;
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

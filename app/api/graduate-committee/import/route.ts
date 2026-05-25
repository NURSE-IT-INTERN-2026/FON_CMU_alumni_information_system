import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureAlumni } from "@/lib/ensure-alumni";
import * as XLSX from "xlsx";
import { checkWritePermission } from "@/lib/permissions";

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);

    const errors: { row: number; message: string }[] = [];
    const records: { termYear: number; studentId: string; fullName: string; cohort: string; position: string; remarks?: string | null }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const termYearStr = row["ปี พ.ศ."]?.toString().trim();
      const studentId = row["รหัสนักศึกษา"]?.toString().trim();
      const fullName = row["ชื่อ-สกุล"]?.toString().trim();
      const cohort = row["รุ่นที่"]?.toString().trim();
      const position = row["ตำแหน่ง"]?.toString().trim();
      const remarks = row["หมายเหตุ"]?.toString().trim() || null;

      if (!termYearStr || !studentId || !fullName || !cohort || !position) {
        errors.push({ row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
        continue;
      }

      const termYear = parseInt(termYearStr, 10);
      if (isNaN(termYear)) {
        errors.push({ row: rowNumber, message: "ปี พ.ศ. ไม่ถูกต้อง" });
        continue;
      }

      records.push({ termYear, studentId, fullName, cohort, position, remarks });
    }

    let imported = 0;
    for (const record of records) {
      try {
        await ensureAlumni(record.studentId, record.fullName);
        await prisma.graduateCommittee.create({ data: record });
        imported++;
      } catch (err) {
        console.error("Import row error:", err);
        errors.push({ row: -1, message: `ไม่สามารถนำเข้าข้อมูล ${record.fullName}: ${err instanceof Error ? err.message : "ข้อผิดพลาด"}` });
      }
    }

    return NextResponse.json({ imported, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/graduate-committee/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}

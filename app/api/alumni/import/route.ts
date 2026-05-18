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
      return NextResponse.json(
        { error: "กรุณาเลือกไฟล์ Excel" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);

    const errors: { row: number; message: string }[] = [];
    let imported = 0;
    let skipped = 0;

    const records = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const studentId = row["รหัสนักศึกษา"]?.toString().trim();
      const prefix = row["คำนำหน้า"]?.toString().trim();
      const firstName = row["ชื่อ"]?.toString().trim();
      const maidenLastName = row["นามสกุลเดิม"]?.toString().trim();
      const cohort = row["รุ่น/สาขา"]?.toString().trim() || null;
      const newLastName = row["นามสกุลใหม่"]?.toString().trim() || null;
      const province = row["จังหวัด"]?.toString().trim() || null;
      const email = row["อีเมล"]?.toString().trim() || null;
      const phone = row["เบอร์โทร"]?.toString().trim() || null;
      const currentWorkplace = row["สถานที่ทำงาน"]?.toString().trim() || null;
      const country = row["ประเทศ"]?.toString().trim() || null;

      if (!studentId || !prefix || !firstName || !maidenLastName) {
        errors.push({ row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
        continue;
      }

      records.push({
        studentId,
        prefix,
        firstName,
        maidenLastName,
        cohort,
        newLastName,
        province,
        email,
        phone,
        currentWorkplace,
        country,
      });
    }

    if (records.length > 0) {
      const result = await prisma.alumni.createMany({
        data: records,
        skipDuplicates: true,
      });
      imported = result.count;
      skipped = records.length - imported;
    }

    return NextResponse.json({ imported, skipped, errors });
  } catch (error) {
    console.error("POST /api/alumni/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

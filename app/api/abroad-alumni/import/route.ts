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
    const records: { name: string; address: string | null; country: string; university: string | null; order: number }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const name = row["ชื่อ-นามสกุล"]?.toString().trim();
      const address = row["ที่อยู่"]?.toString().trim() || null;
      const country = row["ประเทศ"]?.toString().trim();
      const university = row["มหาวิทยาลัย"]?.toString().trim() || null;
      const orderStr = row["ลำดับ"]?.toString().trim();

      if (!name || !country) {
        errors.push({ row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน (ชื่อ-นามสกุล, ประเทศ)" });
        continue;
      }

      const order = orderStr ? parseInt(orderStr, 10) : 0;
      if (orderStr && isNaN(order)) {
        errors.push({ row: rowNumber, message: "ลำดับไม่ถูกต้อง" });
        continue;
      }

      records.push({ name, address, country, university, order });
    }

    let imported = 0;
    if (records.length > 0) {
      const result = await prisma.abroadAlumni.createMany({ data: records });
      imported = result.count;
    }

    return NextResponse.json({ imported, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/abroad-alumni/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}

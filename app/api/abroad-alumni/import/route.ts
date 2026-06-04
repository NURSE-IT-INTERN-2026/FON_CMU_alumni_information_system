import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";
import { checkWritePermission } from "@/lib/permissions";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

import {
  isOriginalFormat,
  parseOriginalFormat,
  parseExportFormat,
  type ParsedAbroadAlumniRow,
} from "@/lib/abroad-alumni-parse";

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
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    // Read raw rows to detect format
    const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, { header: 1, defval: "" });

    let parsed: { data: ParsedAbroadAlumniRow; rowNumber: number }[];

    if (isOriginalFormat(rawRows)) {
      parsed = parseOriginalFormat(rawRows);
    } else {
      const objectRows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);
      parsed = parseExportFormat(objectRows);
    }

    for (const { data, rowNumber } of parsed) {
      if (!data.thaiName && !data.englishName) {
        errors.push({ row: rowNumber, message: "กรุณากรอกชื่อไทยหรือชื่ออังกฤษ" });
        continue;
      }

      try {
        await prisma.abroadAlumni.create({ data });
        imported++;
      } catch (err) {
        console.error("Import row error:", err);
        errors.push({
          row: rowNumber,
          message: `ไม่สามารถนำเข้าข้อมูล: ${err instanceof Error ? err.message : "ข้อผิดพลาด"}`,
        });
      }
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


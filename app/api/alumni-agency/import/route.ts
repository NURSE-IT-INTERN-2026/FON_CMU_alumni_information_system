import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureAlumni } from "@/lib/ensure-alumni";
import { checkWritePermission } from "@/lib/permissions";
import { readExcelRows, readExcelRawRows } from "@/lib/excel-import";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

import {
  isOriginalFormat,
  parseOriginalFormat,
  parseExportFormat,
  type ParsedAlumniAgencyRow,
} from "@/lib/alumni-agency-parse";

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

    const errors: { row: number; message: string }[] = [];
    let imported = 0;
    let updated = 0;

    // Read raw rows to detect format
    const rawRows = await readExcelRawRows(buffer);

    let parsed: { data: ParsedAlumniAgencyRow; rowNumber: number }[];

    if (isOriginalFormat(rawRows)) {
      parsed = parseOriginalFormat(rawRows);
    } else {
      const objectRows = await readExcelRows(buffer);
      parsed = parseExportFormat(objectRows);
    }

    for (const { data, rowNumber } of parsed) {
      if (!data.thaiName && !data.englishName) {
        errors.push({ row: rowNumber, message: "กรุณากรอกชื่อไทยหรือชื่ออังกฤษ" });
        continue;
      }

      try {
        // Sync with CMU when a studentId is provided: link the alumni record
        // and auto-fill major from the Registrar API (backfill only).
        if (data.studentId) {
          const alumni = await ensureAlumni(
            data.studentId,
            data.thaiName || data.englishName || "",
          );
          data.studentId = alumni.studentId;
          if (!data.major) data.major = alumni.major;
        }
        // No DB unique — match by studentId (or thaiName when unlinked) among
        // active rows so re-importing updates an existing entry, not duplicates.
        const existing = await prisma.alumniAgency.findFirst({
          where: {
            deletedAt: null,
            ...(data.studentId
              ? { studentId: data.studentId }
              : { thaiName: data.thaiName ?? null }),
          },
        });
        if (existing) {
          await prisma.alumniAgency.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await prisma.alumniAgency.create({ data });
          imported++;
        }
      } catch (err) {
        console.error("Import row error:", err);
        errors.push({
          row: rowNumber,
          message: `ไม่สามารถนำเข้าข้อมูล: ${err instanceof Error ? err.message : "ข้อผิดพลาด"}`,
        });
      }
    }

    return NextResponse.json({ imported, updated, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/alumni-agency/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}


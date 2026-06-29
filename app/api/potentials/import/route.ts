import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureAlumni } from "@/lib/ensure-alumni";
import { checkWritePermission } from "@/lib/permissions";
import { readExcelRows } from "@/lib/excel-import";
import { splitFullName } from "@/lib/parse-name";
import { logImport, captureFileName, type ImportedRecord } from "@/lib/import-log";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

type NameRow = { studentId: string; prefix: string; firstName: string; lastName: string };

/** Read ชื่อ/นามสกุล/คำนำหน้า columns; fall back to a legacy combined ชื่อ-สกุล column. */
function readName(row: Record<string, unknown>): NameRow {
  const prefixCol = row["คำนำหน้า"]?.toString().trim() || "";
  const firstNameCol = row["ชื่อ"]?.toString().trim() || "";
  const lastNameCol = row["นามสกุล"]?.toString().trim() || "";
  const legacyFull = row["ชื่อ-สกุล"]?.toString().trim() || "";
  if (!firstNameCol && !lastNameCol && legacyFull) {
    const parsed = splitFullName(legacyFull);
    return { studentId: "", prefix: parsed.prefix || "", firstName: parsed.firstName, lastName: parsed.lastName };
  }
  return { studentId: "", prefix: prefixCol, firstName: firstNameCol, lastName: lastNameCol };
}

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
    const records: { studentId: string; prefix: string; firstName: string; lastName: string; career: string; position: string; recordedYear: number }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const studentId = row["รหัสนักศึกษา"]?.toString().trim();
      const name = readName(row);
      const career = row["อาชีพ"]?.toString().trim();
      const position = row["ตำแหน่ง"]?.toString().trim();
      const recordedYearStr = row["ปีที่บันทึก (พ.ศ.)"]?.toString().trim();

      if (!studentId || !name.firstName || !name.lastName || !career || !position || !recordedYearStr) {
        errors.push({ row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
        continue;
      }

      const recordedYear = parseInt(recordedYearStr, 10);
      if (isNaN(recordedYear)) {
        errors.push({ row: rowNumber, message: "ปีที่บันทึกไม่ถูกต้อง" });
        continue;
      }

      records.push({ studentId, prefix: name.prefix, firstName: name.firstName, lastName: name.lastName, career, position, recordedYear });
    }

    let imported = 0;
    let updated = 0;
    const importedRecords: ImportedRecord[] = [];
    for (const record of records) {
      try {
        const displayName = [record.prefix, record.firstName, record.lastName].filter(Boolean).join(" ");
        const alumni = await ensureAlumni(record.studentId, displayName || record.studentId);
        const studentId = alumni.studentId;
        const major = alumni.major ?? null;
        // Upsert on (studentId + recordedYear) so re-importing updates existing
        // rows instead of creating duplicates.
        const existing = await prisma.potential.findUnique({
          where: {
            studentId_recordedYear: {
              studentId,
              recordedYear: record.recordedYear,
            },
          },
        });
        if (existing) {
          await prisma.potential.update({
            where: { id: existing.id },
            data: {
              prefix: record.prefix || null,
              firstName: record.firstName,
              lastName: record.lastName,
              career: record.career,
              position: record.position,
              major,
            },
          });
          updated++;
          importedRecords.push({ id: studentId, name: displayName || studentId, op: "updated" });
        } else {
          await prisma.potential.create({
            data: {
              studentId,
              prefix: record.prefix || null,
              firstName: record.firstName,
              lastName: record.lastName,
              career: record.career,
              position: record.position,
              recordedYear: record.recordedYear,
              major,
            },
          });
          imported++;
          importedRecords.push({ id: studentId, name: displayName || studentId, op: "created" });
        }
      } catch (err) {
        console.error("Import row error:", err);
        const who = [record.firstName, record.lastName].filter(Boolean).join(" ") || record.studentId;
        errors.push({ row: -1, message: `ไม่สามารถนำเข้าข้อมูล ${who}: ${err instanceof Error ? err.message : "ข้อผิดพลาด"}` });
      }
    }

    await logImport({
      ctx: { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      resource: "potential",
      fileName: captureFileName(file),
      attempted: records.length,
      created: imported,
      updated,
      failed: errors.length,
      records: importedRecords,
      errors,
    });

    return NextResponse.json({ imported, updated, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/potentials/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}

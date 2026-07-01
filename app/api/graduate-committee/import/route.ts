import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { resolveAlumniLink, buildAlumniEntityMatchWhere } from "@/lib/alumni-link";
import { checkWritePermission } from "@/lib/permissions";
import { readExcelRows } from "@/lib/excel-import";
import { splitFullName } from "@/lib/parse-name";
import { logImport, captureFileName, type ImportedRecord } from "@/lib/import-log";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

type NameRow = { prefix: string; firstName: string; lastName: string };

/** Read คำนำหน้า/ชื่อ/นามสกุล columns; fall back to a legacy combined ชื่อ-สกุล column. */
function readName(row: Record<string, unknown>): NameRow {
  const prefixCol = row["คำนำหน้า"]?.toString().trim() || "";
  const firstNameCol = row["ชื่อ"]?.toString().trim() || "";
  const lastNameCol = row["นามสกุล"]?.toString().trim() || "";
  const legacyFull = row["ชื่อ-สกุล"]?.toString().trim() || "";
  if (!firstNameCol && !lastNameCol && legacyFull) {
    const parsed = splitFullName(legacyFull);
    return { prefix: parsed.prefix || "", firstName: parsed.firstName, lastName: parsed.lastName };
  }
  return { prefix: prefixCol, firstName: firstNameCol, lastName: lastNameCol };
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
    const records: { termYear: number; studentId: string; prefix: string; firstName: string; lastName: string; cohort: string; position: string; remarks?: string | null }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const termYearStr = row["ปี พ.ศ."]?.toString().trim();
      const studentId = row["รหัสนักศึกษา"]?.toString().trim();
      const name = readName(row);
      const cohort = row["รุ่นที่"]?.toString().trim();
      const position = row["ตำแหน่ง"]?.toString().trim();
      const remarks = row["หมายเหตุ"]?.toString().trim() || null;

      if (!termYearStr || !studentId || !name.firstName || !name.lastName || !cohort || !position) {
        errors.push({ row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
        continue;
      }

      const termYear = parseInt(termYearStr, 10);
      if (isNaN(termYear)) {
        errors.push({ row: rowNumber, message: "ปี พ.ศ. ไม่ถูกต้อง" });
        continue;
      }

      records.push({ termYear, studentId, prefix: name.prefix, firstName: name.firstName, lastName: name.lastName, cohort, position, remarks });
    }

    let imported = 0;
    let updated = 0;
    let pending = 0; // rows saved with `pendingStudentId` (no matching Alumni to link)
    const warnings: { row: number; message: string }[] = [];
    const importedRecords: ImportedRecord[] = [];
    for (const record of records) {
      try {
        const displayName = [record.prefix, record.firstName, record.lastName].filter(Boolean).join(" ");
        // Resolve against EXISTING Alumni only — no stub creation. An unknown id
        // is flagged via `pendingStudentId` (รอเชื่อมโยง).
        const link = await resolveAlumniLink(record.studentId, null);
        if (!link.linked && record.studentId) {
          pending++;
          warnings.push({
            row: -1,
            message: `รหัสนักศึกษา ${record.studentId} ไม่มีข้อมูลศิษย์เก่าให้เชื่อมโยง — บันทึกเป็นรอเชื่อมโยง`,
          });
        }
        const { studentId, pendingStudentId, major } = link;
        // Match by the resolved person AND the natural key (termYear + position)
        // so re-importing updates instead of duplicating.
        const existing = await prisma.graduateCommittee.findFirst({
          where: {
            AND: [
              buildAlumniEntityMatchWhere({ studentId, pendingStudentId, firstName: record.firstName, lastName: record.lastName }),
              { termYear: record.termYear, position: record.position },
            ],
          },
        });
        const effectiveId = studentId ?? pendingStudentId;
        if (existing) {
          await prisma.graduateCommittee.update({
            where: { id: existing.id },
            data: { studentId, pendingStudentId, prefix: record.prefix || null, firstName: record.firstName, lastName: record.lastName, cohort: record.cohort, remarks: record.remarks ?? null, major },
          });
          updated++;
          importedRecords.push({ id: effectiveId, name: displayName, op: "updated" });
        } else {
          await prisma.graduateCommittee.create({
            data: {
              termYear: record.termYear,
              studentId,
              pendingStudentId,
              prefix: record.prefix || null,
              firstName: record.firstName,
              lastName: record.lastName,
              cohort: record.cohort,
              position: record.position,
              remarks: record.remarks ?? null,
              major,
            },
          });
          imported++;
          importedRecords.push({ id: effectiveId, name: displayName, op: "created" });
        }
      } catch (err) {
        console.error("Import row error:", err);
        const who = [record.firstName, record.lastName].filter(Boolean).join(" ") || record.studentId;
        errors.push({ row: -1, message: `ไม่สามารถนำเข้าข้อมูล ${who}: ${err instanceof Error ? err.message : "ข้อผิดพลาด"}` });
      }
    }

    await logImport({
      ctx: { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      resource: "graduate_committee",
      fileName: captureFileName(file),
      attempted: records.length,
      created: imported,
      updated,
      failed: errors.length,
      records: importedRecords,
      errors,
    });

    return NextResponse.json({ imported, updated, skipped: 0, pending, warnings, errors });
  } catch (error) {
    console.error("POST /api/graduate-committee/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}

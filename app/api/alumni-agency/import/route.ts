import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { readExcelRows, readExcelRawRows } from "@/lib/excel-import";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

import {
  isOriginalFormat,
  parseOriginalFormat,
  parseExportFormat,
  alumniAgencyMatchWhere,
  type ParsedAlumniAgencyRow,
} from "@/lib/alumni-agency-parse";
import { logImport, captureFileName, type ImportedRecord } from "@/lib/import-log";
import { syncAgencyHomeAddressToAlumni } from "@/lib/alumni-agency-home-sync";

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

    const ctx = { actorType: "ADMIN" as const, userId: session.user.id, userEmail: session.user.email, userRole: session.user.role };

    const errors: { row: number; message: string }[] = [];
    const warnings: { row: number; message: string }[] = [];
    let imported = 0;
    let updated = 0;
    let pending = 0; // rows saved with `pendingStudentId` (no matching Alumni to link)
    const importedRecords: ImportedRecord[] = [];

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
      if (!data.firstName && !data.lastName && !data.englishName) {
        errors.push({ row: rowNumber, message: "กรุณากรอกชื่อ-นามสกุล หรือชื่ออังกฤษ" });
        continue;
      }

      try {
        const displayName =
          [data.firstName, data.lastName].filter(Boolean).join(" ") ||
          data.englishName ||
          data.studentId ||
          "—";
        // Resolve the studentId against EXISTING Alumni only — we do NOT auto-
        // create a stub alumni (the old ensureAlumni behavior). If no Alumni has
        // this id, the row is FLAGGED via `pendingStudentId` ("no Alumni to link
        // to"). `studentId` is a FK to Alumni.studentId, so it must stay null
        // while the id is only pending.
        const attemptedId = data.studentId;
        if (attemptedId) {
          const linked = await prisma.alumni.findUnique({ where: { studentId: attemptedId } });
          if (linked) {
            data.studentId = linked.studentId;
            data.pendingStudentId = null;
            if (!data.major) data.major = linked.major ?? null;
          } else {
            data.pendingStudentId = attemptedId;
            data.studentId = null;
            pending++;
            warnings.push({
              row: rowNumber,
              message: `รหัสนักศึกษา ${attemptedId} ไม่มีข้อมูลศิษย์เก่าให้เชื่อมโยง — บันทึกเป็นรอเชื่อมโยง`,
            });
          }
        } else {
          data.pendingStudentId = null;
        }
        // Find an existing active row to UPDATE (not duplicate): by the resolved
        // id (studentId OR pendingStudentId), OR by name when the existing row is
        // id-less — so re-importing data that now has an id (e.g. a mock fixture
        // over the real name-only records) updates the existing row instead of
        // creating a duplicate. See alumniAgencyMatchWhere for the exact clauses.
        const existing = await prisma.alumniAgency.findFirst({
          where: alumniAgencyMatchWhere(data),
        });
        const effectiveId = data.studentId ?? data.pendingStudentId ?? null;
        if (existing) {
          await prisma.alumniAgency.update({ where: { id: existing.id }, data });
          updated++;
          importedRecords.push({ id: effectiveId, name: displayName, op: "updated" });
        } else {
          await prisma.alumniAgency.create({ data });
          imported++;
          importedRecords.push({ id: effectiveId, name: displayName, op: "created" });
        }
        // Sync this row's homeAddress onto the linked Alumni (no-op when unlinked,
        // empty, or unchanged). `data.studentId` is the resolved linked id.
        await syncAgencyHomeAddressToAlumni({ ctx, studentId: data.studentId, agencyHomeAddress: data.homeAddress });
      } catch (err) {
        console.error("Import row error:", err);
        errors.push({
          row: rowNumber,
          message: `ไม่สามารถนำเข้าข้อมูล: ${err instanceof Error ? err.message : "ข้อผิดพลาด"}`,
        });
      }
    }

    await logImport({
      ctx,
      resource: "alumni_agency",
      fileName: captureFileName(file),
      attempted: parsed.length,
      created: imported,
      updated,
      failed: errors.length,
      records: importedRecords,
      errors,
    });

    return NextResponse.json({ imported, updated, skipped: 0, pending, warnings, errors });
  } catch (error) {
    console.error("POST /api/alumni-agency/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}


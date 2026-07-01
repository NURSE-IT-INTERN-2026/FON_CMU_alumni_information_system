import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { AwardType } from "@/app/generated/prisma/client";
import { resolveAlumniLink, buildAlumniEntityMatchWhere } from "@/lib/alumni-link";
import { checkWritePermission } from "@/lib/permissions";
import { readExcelRows } from "@/lib/excel-import";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

import { parseAwardRow } from "@/lib/award-import-parse";
import { logImport, captureFileName, type ImportedRecord } from "@/lib/import-log";

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
    const warnings: { row: number; message: string }[] = [];
    let imported = 0;
    let updated = 0;
    let pending = 0; // rows saved with `pendingStudentId` (no matching Alumni to link)
    const importedRecords: ImportedRecord[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const { data, error } = parseAwardRow(rows[i], rowNumber);

      if (error) {
        errors.push(error);
        continue;
      }

      try {
        const displayName = [data!.prefix, data!.firstName, data!.lastName]
          .filter(Boolean)
          .join(" ") || data!.awardName;
        // Resolve the studentId against EXISTING Alumni only — no stub creation.
        // An unknown id is flagged via `pendingStudentId` (รอเชื่อมโยง).
        const link = await resolveAlumniLink(data!.studentId, null);
        if (!link.linked && data!.studentId) {
          pending++;
          warnings.push({
            row: rowNumber,
            message: `รหัสนักศึกษา ${data!.studentId} ไม่มีข้อมูลศิษย์เก่าให้เชื่อมโยง — บันทึกเป็นรอเชื่อมโยง`,
          });
        }
        const { studentId, pendingStudentId, major } = link;

        const payload = {
          studentId,
          pendingStudentId,
          prefix: data!.prefix,
          firstName: data!.firstName,
          lastName: data!.lastName,
          awardName: data!.awardName,
          awardType: data!.awardType as AwardType,
          year: data!.year,
          link: data!.link,
          imageUrl: data!.imageUrl,
          description: data!.description,
          major,
        };

        // No DB unique — match by the resolved person (studentId OR
        // pendingStudentId, OR name for id-less rows) AND the natural key
        // (awardName + year) so re-importing updates instead of duplicating.
        const existing = await prisma.award.findFirst({
          where: {
            AND: [
              buildAlumniEntityMatchWhere({ studentId, pendingStudentId, firstName: data!.firstName, lastName: data!.lastName }),
              { awardName: data!.awardName, year: data!.year },
            ],
          },
        });
        const effectiveId = studentId ?? pendingStudentId ?? null;
        if (existing) {
          await prisma.award.update({ where: { id: existing.id }, data: payload });
          updated++;
          importedRecords.push({ id: effectiveId, name: displayName, op: "updated" });
        } else {
          await prisma.award.create({ data: payload });
          imported++;
          importedRecords.push({ id: effectiveId, name: displayName, op: "created" });
        }
      } catch {
        errors.push({
          row: rowNumber,
          message: `ไม่สามารถนำเข้าข้อมูลแถวนี้ได้`,
        });
      }
    }

    await logImport({
      ctx: { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      resource: "award",
      fileName: captureFileName(file),
      attempted: rows.length,
      created: imported,
      updated,
      failed: errors.length,
      records: importedRecords,
      errors,
    });

    return NextResponse.json({ imported, updated, skipped: 0, pending, warnings, errors });
  } catch (error) {
    console.error("POST /api/awards/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}


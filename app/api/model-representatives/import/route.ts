import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureAlumni } from "@/lib/ensure-alumni";
import { checkWritePermission } from "@/lib/permissions";
import { readExcelRows } from "@/lib/excel-import";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
    const records: { studentId: string; name: string; cohort: string; generation: number }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const studentId = row["รหัสนักศึกษา"]?.toString().trim();
      const name = row["ชื่อ-นามสกุล"]?.toString().trim();
      const cohort = row["เครือข่าย"]?.toString().trim();
      const generationStr = row["ลำดับรุ่น"]?.toString().trim();

      if (!studentId || !name || !cohort || !generationStr) {
        errors.push({ row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
        continue;
      }

      const generation = parseInt(generationStr, 10);
      if (isNaN(generation)) {
        errors.push({ row: rowNumber, message: "ลำดับรุ่นไม่ถูกต้อง" });
        continue;
      }

      records.push({ studentId, name, cohort, generation });
    }

    let imported = 0;
    let updated = 0;
    for (const record of records) {
      try {
        const alumni = await ensureAlumni(record.studentId, record.name);
        const studentId = alumni.studentId;
        const major = alumni.major ?? null;
        // Upsert on (studentId + cohort + generation) so re-importing updates
        // existing rows instead of creating duplicates.
        const existing = await prisma.modelRepresentative.findUnique({
          where: {
            studentId_cohort_generation: {
              studentId,
              cohort: record.cohort,
              generation: record.generation,
            },
          },
        });
        if (existing) {
          await prisma.modelRepresentative.update({
            where: { id: existing.id },
            data: { name: record.name, major },
          });
          updated++;
        } else {
          await prisma.modelRepresentative.create({
            data: {
              studentId,
              name: record.name,
              cohort: record.cohort,
              generation: record.generation,
              major,
            },
          });
          imported++;
        }
      } catch (err) {
        console.error("Import row error:", err);
        errors.push({ row: -1, message: `ไม่สามารถนำเข้าข้อมูล ${record.name}: ${err instanceof Error ? err.message : "ข้อผิดพลาด"}` });
      }
    }

    return NextResponse.json({ imported, updated, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/model-representatives/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" },
      { status: 500 }
    );
  }
}

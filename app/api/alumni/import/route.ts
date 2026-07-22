import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DegreeLevel } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logImport, captureFileName, type ImportedRecord } from "@/lib/import-log";
import { readExcelRows } from "@/lib/excel-import";
import { parsePhones } from "@/lib/parse-phone";
import { ensurePrimaryEducationFromSnapshot } from "@/lib/education-sync";
import { autoLinkPendingForAlumni } from "@/lib/alumni-link";
import { mirrorAlumniHomeAddressToAgencies } from "@/lib/alumni-agency-home-sync";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const DEGREE_LEVEL_MAP: Record<string, DegreeLevel> = {
  "ปริญญาเอก": "DOCTORAL",
  "ปริญญาโท": "MASTER",
  "ปริญญาตรี": "BACHELOR",
  "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล": "NURSING_ASSISTANT",
  "อนุปริญญา": "ASSOCIATE",
  "DOCTORAL": "DOCTORAL",
  "MASTER": "MASTER",
  "BACHELOR": "BACHELOR",
  "NURSING_ASSISTANT": "NURSING_ASSISTANT",
  "ASSOCIATE": "ASSOCIATE",
};

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
      return NextResponse.json(
        { error: "กรุณาเลือกไฟล์ Excel" },
        { status: 400 }
      );
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
    const records: {
      studentId: string;
      prefix: string;
      firstName: string;
      lastName: string;
      cohort: string | null;
      degreeLevel: DegreeLevel;
      contactEmail: string | null;
      phones: string[];
      homeAddress: string | null;
    }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const studentId = row["รหัสนักศึกษา"]?.toString().trim();
      const prefix = row["คำนำหน้า"]?.toString().trim();
      const firstName = row["ชื่อ"]?.toString().trim();
      const lastName = row["นามสกุล"]?.toString().trim();
      const cohort = row["รุ่น/สาขา"]?.toString().trim() || null;
      const degreeLevelRaw = row["ระดับการศึกษา"]?.toString().trim();
      const degreeLevel = degreeLevelRaw
        ? DEGREE_LEVEL_MAP[degreeLevelRaw] || "BACHELOR"
        : "BACHELOR";
      // อีเมล is the CONTACT email (NOT the auth/login `email`).
      const contactEmail = row["อีเมล"]?.toString().trim() || null;
      // เบอร์โทร may hold several numbers (comma-separated, possibly with a
      // "มือถือ" label) — parse into a list, never a clumped string.
      const phones = parsePhones(row["เบอร์โทร"]);
      const homeAddress = row["ที่อยู่ปัจจุบัน"]?.toString().trim() || null;

      if (!studentId || !prefix || !firstName || !lastName) {
        errors.push({ row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
        continue;
      }

      if (!/^\d+$/.test(studentId)) {
        errors.push({ row: rowNumber, message: "รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น" });
        continue;
      }

      records.push({
        studentId,
        prefix,
        firstName,
        lastName,
        cohort,
        degreeLevel,
        contactEmail,
        phones,
        homeAddress,
      });
    }

    let imported = 0;
    let created = 0;
    let updated = 0;
    const importedRecords: ImportedRecord[] = [];
    const ctx = { actorType: "ADMIN" as const, userId: session.user.id, userEmail: session.user.email, userRole: session.user.role };

    for (const record of records) {
      const result = await prisma.alumni.upsert({
        where: { studentId: record.studentId },
        update: {
          prefix: record.prefix,
          firstName: record.firstName,
          lastName: record.lastName,
          cohort: record.cohort,
          degreeLevel: record.degreeLevel,
          contactEmail: record.contactEmail,
          phones: record.phones,
          homeAddress: record.homeAddress,
        },
        create: record,
      });
      // Ensure the primary Education row exists (no-op when already set), so a
      // freshly imported alumni — or one re-imported before the backfill ran —
      // always has a degree card on its profile.
      if (result) {
        await ensurePrimaryEducationFromSnapshot(result.id);
        // An upsert returns the row either way; on a fresh create Prisma sets
        // createdAt and updatedAt to the same instant, so equal timestamps ⇒ created.
        const op: ImportedRecord["op"] =
          result.createdAt.getTime() === result.updatedAt.getTime() ? "created" : "updated";

        // homeAddress unification: mirror the imported address onto this
        // alumni's linked agency rows (both create + update set homeAddress).
        await mirrorAlumniHomeAddressToAgencies({
          studentId: record.studentId,
          alumniHomeAddress: record.homeAddress,
        });
        // A freshly created alumni is now canonical — link any pre-existing
        // pending rows across the 6 related entities (no-op on re-import where
        // the alumni already existed and was linked long ago).
        if (op === "created") {
          await autoLinkPendingForAlumni({ alumniId: result.id, studentId: record.studentId, ctx, tx: prisma });
        }

        if (op === "created") created++;
        else updated++;
        imported++;
        importedRecords.push({
          id: record.studentId,
          name: `${record.prefix} ${record.firstName} ${record.lastName}`.trim(),
          op,
        });
      }
    }

    await logImport({
      ctx: {
        actorType: "ADMIN",
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: session.user.role,
      },
      resource: "alumni",
      fileName: captureFileName(file),
      attempted: records.length,
      created,
      updated,
      failed: errors.length,
      records: importedRecords,
      errors,
    });

    return NextResponse.json({ imported, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/alumni/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

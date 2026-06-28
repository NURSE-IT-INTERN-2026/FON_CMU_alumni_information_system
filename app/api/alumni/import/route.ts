import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DegreeLevel } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { recordFieldChanges } from "@/lib/field-changes";
import { readExcelRows } from "@/lib/excel-import";

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

// Reason stamped on every import-driven name change so admins/alumni can tell
// the auto-edit (นามสกุลเดิม → นามสกุลใหม่) apart from a hands-on edit.
const NAME_CHANGE_REASON = "นำเข้านามสกุลใหม่จากการอิมพอร์ต";

interface ImportRecord {
  studentId: string;
  prefix: string;
  firstName: string;
  oldLastName: string;
  newLastName: string; // "" when the column is blank
  finalLastName: string; // newLastName || oldLastName
  hasNameChange: boolean; // newLastName !== "" && newLastName !== oldLastName
  cohort: string | null;
  degreeLevel: DegreeLevel;
  email: string | null;
  phone: string | null;
  homeAddress: string | null;
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
    const records: ImportRecord[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const studentId = row["รหัสนักศึกษา"]?.toString().trim();
      const prefix = row["คำนำหน้า"]?.toString().trim();
      const firstName = row["ชื่อ"]?.toString().trim();
      // นามสกุลเดิม is the required maiden/old last name. Fall back to the
      // legacy "นามสกุล" header so an exported file (which still uses that
      // header) round-trips through import unchanged.
      const oldLastName = (row["นามสกุลเดิม"] ?? row["นามสกุล"] ?? "")
        .toString()
        .trim();
      const newLastName = (row["นามสกุลใหม่"] ?? "").toString().trim();
      const cohort = row["รุ่น/สาขา"]?.toString().trim() || null;
      const degreeLevelRaw = row["ระดับการศึกษา"]?.toString().trim();
      const degreeLevel = degreeLevelRaw
        ? DEGREE_LEVEL_MAP[degreeLevelRaw] || "BACHELOR"
        : "BACHELOR";
      const email = row["อีเมล"]?.toString().trim() || null;
      const phone = row["เบอร์โทร"]?.toString().trim() || null;
      const homeAddress = row["ที่อยู่ปัจจุบัน"]?.toString().trim() || null;

      if (!studentId || !prefix || !firstName || !oldLastName) {
        errors.push({ row: rowNumber, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
        continue;
      }

      if (!/^\d+$/.test(studentId)) {
        errors.push({ row: rowNumber, message: "รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น" });
        continue;
      }

      const hasNameChange = newLastName !== "" && newLastName !== oldLastName;
      records.push({
        studentId,
        prefix,
        firstName,
        oldLastName,
        newLastName,
        finalLastName: newLastName !== "" ? newLastName : oldLastName,
        hasNameChange,
        cohort,
        degreeLevel,
        email,
        phone,
        homeAddress,
      });
    }

    const actor = {
      actorType: "ADMIN" as const,
      userId: session.user.id,
      userEmail: session.user.email,
      userRole: session.user.role,
    };

    let imported = 0;
    let nameChanges = 0;

    for (const record of records) {
      const baseData = {
        prefix: record.prefix,
        firstName: record.firstName,
        cohort: record.cohort,
        degreeLevel: record.degreeLevel,
        email: record.email,
        phone: record.phone,
        homeAddress: record.homeAddress,
      };

      const existing = await prisma.alumni.findUnique({
        where: { studentId: record.studentId },
      });

      let alumniId: string;
      // The "from" value for the change log. null ⇒ no edit to record.
      let changeFrom: string | null = null;

      if (existing) {
        // Refresh an existing record. Land on the final (new, if any) last
        // name directly; only log when it actually differs from what's stored
        // so re-importing the same file is idempotent.
        alumniId = existing.id;
        await prisma.alumni.update({
          where: { studentId: record.studentId },
          data: {
            ...baseData,
            lastName: record.finalLastName,
            ...(record.hasNameChange ? { nameManuallyUpdated: true } : {}),
          },
        });
        if (record.hasNameChange && existing.lastName !== record.finalLastName) {
          changeFrom = existing.lastName;
        }
      } else {
        // New record: create with the final last name, then record the
        // historical นามสกุลเดิม → นามสกุลใหม่ change as an auto-edit so the
        // field shows an orange indicator and the old name is preserved in
        // the edit history.
        const created = await prisma.alumni.create({
          data: {
            studentId: record.studentId,
            ...baseData,
            lastName: record.finalLastName,
            ...(record.hasNameChange ? { nameManuallyUpdated: true } : {}),
          },
        });
        alumniId = created.id;
        if (record.hasNameChange) changeFrom = record.oldLastName;
      }

      if (changeFrom !== null) {
        nameChanges++;
        // Fire-and-forget history (both helpers swallow errors internally).
        await recordFieldChanges({
          resourceType: "alumni",
          resourceId: alumniId,
          changes: [
            { field: "lastName", from: changeFrom, to: record.finalLastName },
          ],
          actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email },
          reason: NAME_CHANGE_REASON,
        });
        await logActivity(
          actor,
          "UPDATE",
          "alumni",
          alumniId,
          {
            field: "lastName",
            from: changeFrom,
            to: record.finalLastName,
            source: "import-name-change",
          },
          NAME_CHANGE_REASON
        );
      }

      imported++;
    }

    await logActivity(
      actor,
      "IMPORT",
      "alumni",
      null,
      {
        imported,
        nameChanges,
        attempted: records.length,
        errors: errors.length,
      }
    );

    return NextResponse.json({ imported, nameChanges, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/alumni/import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

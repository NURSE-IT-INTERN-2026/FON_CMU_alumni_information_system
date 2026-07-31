import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { isXlsxFile, readExcelRows } from "@/lib/excel-import";
import { splitFullName } from "@/lib/parse-name";
import { logImport, captureFileName, type ImportedRecord, type ImportErrorRow } from "@/lib/import-log";
import {
  fetchAlumniByStudentIds,
  fetchExistingEntityRows,
  linkResultFromMap,
  existingIdentityKey,
  incomingIdentityKeys,
  buildExistingKeyMap,
  partitionImport,
  chunkedCreateMany,
  type Identity,
} from "@/lib/import-batch";

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

/** A parsed graduate-committee row with its resolved alumni link. */
type Resolved = {
  rowNumber: number;
  attemptedStudentId: string; // raw id from the row (for the warning + link call)
  studentId: string | null; // resolved (linked) FK
  pendingStudentId: string | null;
  major: string | null;
  prefix: string;
  firstName: string;
  lastName: string;
  termYear: number;
  cohort: string;
  position: string;
  remarks: string | null;
};

const identityOf = (r: Resolved): Identity => ({
  studentId: r.studentId,
  pendingStudentId: r.pendingStudentId,
  firstName: r.firstName,
  lastName: r.lastName,
});
const naturalKey = (r: Resolved) => `${r.termYear}|${r.position}`;
const candidates = (r: Resolved) => incomingIdentityKeys(identityOf(r)).map((k) => `${k}|${naturalKey(r)}`);

function buildCreate(r: Resolved): Record<string, unknown> {
  return {
    termYear: r.termYear,
    studentId: r.studentId,
    pendingStudentId: r.pendingStudentId,
    prefix: r.prefix || null,
    firstName: r.firstName,
    lastName: r.lastName,
    cohort: r.cohort,
    position: r.position,
    remarks: r.remarks ?? null,
    major: r.major,
  };
}
function buildUpdate(r: Resolved): Record<string, unknown> {
  return {
    studentId: r.studentId,
    pendingStudentId: r.pendingStudentId,
    prefix: r.prefix || null,
    firstName: r.firstName,
    lastName: r.lastName,
    cohort: r.cohort,
    remarks: r.remarks ?? null,
    major: r.major,
  };
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
      return NextResponse.json({ error: "ไฟล์มีขนาดเกิน 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isXlsxFile(buffer)) {
      return NextResponse.json({ error: "ไฟล์ต้องเป็นนามสกุล .xlsx เท่านั้น" }, { status: 400 });
    }
    const rows = await readExcelRows(buffer);

    const errors: ImportErrorRow[] = [];
    const warnings: ImportErrorRow[] = [];

    // 1) Parse + validate every row up front (invalid rows never reach the batch).
    const raw: Omit<Resolved, "studentId" | "pendingStudentId" | "major">[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const termYearStr = row["ปี พ.ศ."]?.toString().trim();
      const studentId = row["รหัสนักศึกษา"]?.toString().trim() || "";
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

      raw.push({ rowNumber, attemptedStudentId: studentId, prefix: name.prefix, firstName: name.firstName, lastName: name.lastName, termYear, cohort, position, remarks });
    }

    const ctx = { actorType: "ADMIN" as const, userId: session.user.id, userEmail: session.user.email, userRole: session.user.role };

    // 2) ONE findMany resolves every studentId against existing alumni.
    const alumniByStudentId = await fetchAlumniByStudentIds(raw.map((r) => r.attemptedStudentId || null));

    // 3) Resolve each row's link in-memory + collect pending (unlinked) warnings.
    let pending = 0;
    const resolved: Resolved[] = raw.map((r) => {
      const link = linkResultFromMap(r.attemptedStudentId || null, null, alumniByStudentId);
      if (!link.linked && r.attemptedStudentId) {
        pending++;
        warnings.push({ row: -1, message: `รหัสนักศึกษา ${r.attemptedStudentId} ไม่มีข้อมูลศิษย์เก่าให้เชื่อมโยง — บันทึกเป็นรอเชื่อมโยง` });
      }
      return { ...r, studentId: link.studentId, pendingStudentId: link.pendingStudentId, major: link.major };
    });

    // 4) ONE findMany for existing graduate-committee rows that could match.
    const linkedIds = resolved.map((r) => r.studentId).filter((s): s is string => !!s);
    const pendingIds = resolved.map((r) => r.pendingStudentId).filter((s): s is string => !!s);
    const namePairs = [
      ...new Set(resolved.filter((r) => r.firstName && r.lastName).map((r) => `${r.firstName}|${r.lastName}`)),
    ].map((s) => { const [firstName, lastName] = s.split("|"); return { firstName, lastName }; });

    const existingRows = await fetchExistingEntityRows<{
      id: string; studentId: string | null; pendingStudentId: string | null; firstName: string; lastName: string;
      termYear: number; position: string;
    }>({
      model: "graduateCommittee",
      linkedStudentIds: linkedIds,
      pendingStudentIds: pendingIds,
      namePairs,
      select: { id: true, studentId: true, pendingStudentId: true, firstName: true, lastName: true, termYear: true, position: true },
    });

    // 5) Partition create vs update in-memory (with within-file dedup, last-wins).
    const existingByKey = buildExistingKeyMap(
      existingRows,
      (e) => `${existingIdentityKey({ studentId: e.studentId, pendingStudentId: e.pendingStudentId, firstName: e.firstName, lastName: e.lastName })}|${e.termYear}|${e.position}`,
      (e) => e.id,
    );
    const { toCreate, toUpdate } = partitionImport(resolved, existingByKey, candidates, (r) => candidates(r)[0]);

    let imported = 0;
    let updated = 0;
    const importedRecords: ImportedRecord[] = [];

    const recordOf = (r: Resolved, op: ImportedRecord["op"]): ImportedRecord => ({
      id: r.studentId ?? r.pendingStudentId ?? null,
      name: [r.prefix, r.firstName, r.lastName].filter(Boolean).join(" "),
      op,
    });

    // 6) Chunked createMany (per-row fallback isolates a bad row) for new rows.
    await chunkedCreateMany(toCreate, buildCreate, {
      createMany: (payloads) => prisma.graduateCommittee.createMany({ data: payloads as never }),
      createOne: (payload) => prisma.graduateCommittee.create({ data: payload as never }),
      onCreated: (r) => { imported++; importedRecords.push(recordOf(r, "created")); },
      onError: (r, e) => {
        console.error("Import create row error:", e);
        const who = [r.firstName, r.lastName].filter(Boolean).join(" ") || (r.pendingStudentId ?? "");
        errors.push({ row: -1, message: `ไม่สามารถนำเข้าข้อมูล ${who}: ${e instanceof Error ? e.message : "ข้อผิดพลาด"}` });
      },
    });

    // 7) Per-row update for matched rows (non-uniform payload ⇒ irreducible 1 op/row).
    for (const { row, existingId } of toUpdate) {
      try {
        await prisma.graduateCommittee.update({ where: { id: existingId }, data: buildUpdate(row) as never });
        updated++;
        importedRecords.push(recordOf(row, "updated"));
      } catch (e) {
        console.error("Import update row error:", e);
        const who = [row.firstName, row.lastName].filter(Boolean).join(" ") || (row.pendingStudentId ?? "");
        errors.push({ row: -1, message: `ไม่สามารถนำเข้าข้อมูล ${who}: ${e instanceof Error ? e.message : "ข้อผิดพลาด"}` });
      }
    }

    await logImport({
      ctx,
      resource: "graduate_committee",
      fileName: captureFileName(file),
      attempted: resolved.length,
      created: imported,
      updated,
      failed: errors.length,
      records: importedRecords,
      errors,
    });

    return NextResponse.json({ imported, updated, skipped: 0, pending, warnings, errors });
  } catch (error) {
    console.error("POST /api/graduate-committee/import error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" }, { status: 500 });
  }
}

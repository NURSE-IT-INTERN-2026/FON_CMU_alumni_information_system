import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { AwardType } from "@/app/generated/prisma/client";
import { checkWritePermission } from "@/lib/permissions";
import { readExcelRows } from "@/lib/excel-import";
import { parseAwardRow, type ParsedAwardRow } from "@/lib/award-import-parse";
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

/** A parsed award row with its resolved alumni link. */
type ResolvedAward = {
  data: ParsedAwardRow;
  rowNumber: number;
  studentId: string | null;
  pendingStudentId: string | null;
  major: string | null;
};

const identityOf = (r: ResolvedAward): Identity => ({
  studentId: r.studentId,
  pendingStudentId: r.pendingStudentId,
  firstName: r.data.firstName,
  lastName: r.data.lastName,
});
const naturalKey = (r: ResolvedAward) => `${r.data.awardName}|${r.data.year}`;
const compositeCandidates = (r: ResolvedAward) =>
  incomingIdentityKeys(identityOf(r)).map((k) => `${k}|${naturalKey(r)}`);

/** The award payload written on both create and update (identical — same fields). */
function awardPayload(r: ResolvedAward): Record<string, unknown> {
  return {
    studentId: r.studentId,
    pendingStudentId: r.pendingStudentId,
    prefix: r.data.prefix,
    firstName: r.data.firstName,
    lastName: r.data.lastName,
    awardName: r.data.awardName,
    awardType: r.data.awardType as AwardType,
    year: r.data.year,
    link: r.data.link,
    imageUrl: r.data.imageUrl,
    description: r.data.description,
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
    const rows = await readExcelRows(buffer);

    const errors: ImportErrorRow[] = [];
    const warnings: ImportErrorRow[] = [];
    const parsed: { data: ParsedAwardRow; rowNumber: number }[] = [];

    // 1) Parse + validate every row up front (invalid rows never reach the batch).
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const { data, error } = parseAwardRow(rows[i], rowNumber);
      if (error) {
        errors.push(error);
        continue;
      }
      parsed.push({ data: data!, rowNumber });
    }

    const ctx = { actorType: "ADMIN" as const, userId: session.user.id, userEmail: session.user.email, userRole: session.user.role };

    // 2) ONE findMany resolves every studentId against existing alumni.
    const alumniByStudentId = await fetchAlumniByStudentIds(parsed.map((p) => p.data.studentId));

    // 3) Resolve each row's link in-memory + collect pending (unlinked) warnings.
    let pending = 0;
    const resolved: ResolvedAward[] = parsed.map((p) => {
      const link = linkResultFromMap(p.data.studentId, null, alumniByStudentId);
      if (!link.linked && p.data.studentId) {
        pending++;
        warnings.push({
          row: p.rowNumber,
          message: `รหัสนักศึกษา ${p.data.studentId} ไม่มีข้อมูลศิษย์เก่าให้เชื่อมโยง — บันทึกเป็นรอเชื่อมโยง`,
        });
      }
      return {
        data: p.data,
        rowNumber: p.rowNumber,
        studentId: link.studentId,
        pendingStudentId: link.pendingStudentId,
        major: link.major,
      };
    });

    // 4) ONE findMany for existing award rows that could match any parsed row.
    const linkedIds = resolved.map((r) => r.studentId).filter((s): s is string => !!s);
    const pendingIds = resolved.map((r) => r.pendingStudentId).filter((s): s is string => !!s);
    const namePairs = [
      ...new Set(
        resolved
          .filter((r) => r.data.firstName && r.data.lastName)
          .map((r) => `${r.data.firstName}|${r.data.lastName}`),
      ),
    ].map((s) => {
      const [firstName, lastName] = s.split("|");
      return { firstName, lastName };
    });

    const existingRows = await fetchExistingEntityRows<{
      id: string;
      studentId: string | null;
      pendingStudentId: string | null;
      firstName: string;
      lastName: string;
      awardName: string;
      year: number;
    }>({
      model: "award",
      linkedStudentIds: linkedIds,
      pendingStudentIds: pendingIds,
      namePairs,
      select: { id: true, studentId: true, pendingStudentId: true, firstName: true, lastName: true, awardName: true, year: true },
    });

    // 5) Partition create vs update in-memory (with within-file dedup, last-wins).
    const existingByKey = buildExistingKeyMap(
      existingRows,
      (e) => `${existingIdentityKey({ studentId: e.studentId, pendingStudentId: e.pendingStudentId, firstName: e.firstName, lastName: e.lastName })}|${e.awardName}|${e.year}`,
      (e) => e.id,
    );
    const { toCreate, toUpdate } = partitionImport(resolved, existingByKey, compositeCandidates, (r) => compositeCandidates(r)[0]);

    let imported = 0;
    let updated = 0;
    const importedRecords: ImportedRecord[] = [];

    const recordOf = (r: ResolvedAward, op: ImportedRecord["op"]): ImportedRecord => ({
      id: r.studentId ?? r.pendingStudentId ?? null,
      name: [r.data.prefix, r.data.firstName, r.data.lastName].filter(Boolean).join(" ") || r.data.awardName,
      op,
    });

    // 6) Chunked createMany (per-row fallback isolates a bad row) for new rows.
    await chunkedCreateMany(toCreate, awardPayload, {
      createMany: (payloads) => prisma.award.createMany({ data: payloads as never }),
      createOne: (payload) => prisma.award.create({ data: payload as never }),
      onCreated: (r) => {
        imported++;
        importedRecords.push(recordOf(r, "created"));
      },
      onError: (r, e) => {
        console.error("Import create row error:", e);
        errors.push({ row: r.rowNumber, message: "ไม่สามารถนำเข้าข้อมูลแถวนี้ได้" });
      },
    });

    // 7) Per-row update for matched rows (non-uniform payload ⇒ irreducible 1 op/row;
    //    the read-side bulk above already removed the per-row findFirst).
    for (const { row, existingId } of toUpdate) {
      try {
        await prisma.award.update({ where: { id: existingId }, data: awardPayload(row) as never });
        updated++;
        importedRecords.push(recordOf(row, "updated"));
      } catch (e) {
        console.error("Import update row error:", e);
        errors.push({ row: row.rowNumber, message: "ไม่สามารถนำเข้าข้อมูลแถวนี้ได้" });
      }
    }

    await logImport({
      ctx,
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
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" }, { status: 500 });
  }
}

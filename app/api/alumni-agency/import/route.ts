import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { readExcelRows, readExcelRawRows, isXlsxFile } from "@/lib/excel-import";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

import {
  isOriginalFormat,
  parseOriginalFormat,
  parseExportFormat,
  type ParsedAlumniAgencyRow,
} from "@/lib/alumni-agency-parse";
import { logImport, captureFileName, type ImportErrorRow } from "@/lib/import-log";
import { syncAgencyHomeAddressToAlumniBulk } from "@/lib/alumni-agency-home-sync";
import {
  fetchAlumniByStudentIds,
  fetchExistingEntityRows,
  existingIdentityKey,
  incomingIdentityKeys,
  buildExistingKeyMap,
  partitionImport,
  chunkedCreateMany,
  type Identity,
} from "@/lib/import-batch";

type Row = { data: ParsedAlumniAgencyRow; rowNumber: number };

const identityOf = (r: Row): Identity => ({
  studentId: r.data.studentId,
  pendingStudentId: r.data.pendingStudentId,
  firstName: r.data.firstName,
  lastName: r.data.lastName,
});
// alumni-agency matches by identity ONLY (no natural key — one row per person),
// so the composite key is the bare identity key.
const candidates = (r: Row) => incomingIdentityKeys(identityOf(r));

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

    const ctx = { actorType: "ADMIN" as const, userId: session.user.id, userEmail: session.user.email, userRole: session.user.role };

    const errors: ImportErrorRow[] = [];
    const warnings: ImportErrorRow[] = [];

    // 1) Detect format + parse every row.
    const rawRows = await readExcelRawRows(buffer);
    const parsed: Row[] = isOriginalFormat(rawRows)
      ? parseOriginalFormat(rawRows)
      : parseExportFormat(await readExcelRows(buffer));

    // 2) Validate + ONE findMany to resolve every studentId against existing alumni.
    const alumniByStudentId = await fetchAlumniByStudentIds(parsed.map((p) => p.data.studentId));

    // 3) Resolve each row's link in-memory (alumni-agency keeps its parsed `major`
    //    unless empty — differs from resolveAlumniLink, so the logic is inlined).
    let pending = 0;
    const resolved: Row[] = [];
    for (const p of parsed) {
      const data = p.data;
      if (!data.firstName && !data.lastName && !data.englishName) {
        errors.push({ row: p.rowNumber, message: "กรุณากรอกชื่อ-นามสกุล หรือชื่ออังกฤษ" });
        continue;
      }
      const attemptedId = data.studentId;
      if (attemptedId) {
        const linked = alumniByStudentId.get(attemptedId);
        if (linked) {
          data.studentId = attemptedId;
          data.pendingStudentId = null;
          if (!data.major) data.major = linked.major ?? null;
        } else {
          data.pendingStudentId = attemptedId;
          data.studentId = null;
          pending++;
          warnings.push({ row: p.rowNumber, message: `รหัสนักศึกษา ${attemptedId} ไม่มีข้อมูลศิษย์เก่าให้เชื่อมโยง — บันทึกเป็นรอเชื่อมโยง` });
        }
      } else {
        data.pendingStudentId = null;
      }
      resolved.push(p);
    }

    // 4) ONE findMany for existing alumni-agency rows that could match any parsed
    //    row. Name pairs include null/null so englishName-only rows match too.
    const linkedIds = resolved.map((r) => r.data.studentId).filter((s): s is string => !!s);
    const pendingIds = resolved.map((r) => r.data.pendingStudentId).filter((s): s is string => !!s);
    const namePairs = [
      ...new Set(resolved.map((r) => `${r.data.firstName ?? ""}|${r.data.lastName ?? ""}`)),
    ].map((s) => { const [firstName, lastName] = s.split("|"); return { firstName: firstName || null, lastName: lastName || null }; });

    const existingRows = await fetchExistingEntityRows<{
      id: string; studentId: string | null; pendingStudentId: string | null; firstName: string | null; lastName: string | null;
    }>({
      model: "alumniAgency",
      linkedStudentIds: linkedIds,
      pendingStudentIds: pendingIds,
      namePairs,
      select: { id: true, studentId: true, pendingStudentId: true, firstName: true, lastName: true },
    });

    // 5) Partition create vs update in-memory (with within-file dedup, last-wins).
    const existingByKey = buildExistingKeyMap(
      existingRows,
      (e) => existingIdentityKey({ studentId: e.studentId, pendingStudentId: e.pendingStudentId, firstName: e.firstName, lastName: e.lastName }),
      (e) => e.id,
    );
    const { toCreate, toUpdate } = partitionImport(resolved, existingByKey, candidates, (r) => candidates(r)[0]);

    let imported = 0;
    let updated = 0;

    const payloadOf = (r: Row): Record<string, unknown> => ({ ...r.data });

    // 6) Chunked createMany (per-row fallback isolates a bad row) for new rows.
    await chunkedCreateMany(toCreate, payloadOf, {
      createMany: (payloads) => prisma.alumniAgency.createMany({ data: payloads as never }),
      createOne: (payload) => prisma.alumniAgency.create({ data: payload as never }),
      onCreated: () => { imported++; },
      onError: (r, e) => {
        console.error("Import create row error:", e);
        errors.push({ row: r.rowNumber, message: `ไม่สามารถนำเข้าข้อมูล: ${e instanceof Error ? e.message : "ข้อผิดพลาด"}` });
      },
    });

    // 7) Per-row update for matched rows (the parsed `data` is the full payload).
    for (const { row, existingId } of toUpdate) {
      try {
        await prisma.alumniAgency.update({ where: { id: existingId }, data: payloadOf(row) as never });
        updated++;
      } catch (e) {
        console.error("Import update row error:", e);
        errors.push({ row: row.rowNumber, message: `ไม่สามารถนำเข้าข้อมูล: ${e instanceof Error ? e.message : "ข้อผิดพลาด"}` });
      }
    }

    // 8) Bulk reverse homeAddress sync: ONE findMany for the linked alumni, push
    //    each agency address onto its alumni where it differs (one UPDATE log +
    //    field-change per real change — orange indicator unchanged).
    const addressesByStudentId = new Map<string, string | null>();
    for (const r of [...toCreate, ...toUpdate.map((t) => t.row)]) {
      if (r.data.studentId) addressesByStudentId.set(r.data.studentId, r.data.homeAddress);
    }
    await syncAgencyHomeAddressToAlumniBulk({ ctx, addressesByStudentId });

    await logImport({
      ctx,
      resource: "alumni_agency",
      fileName: captureFileName(file),
      attempted: resolved.length,
      created: imported,
      updated,
      failed: errors.length,
      errors,
    });

    return NextResponse.json({ imported, updated, skipped: 0, pending, warnings, errors });
  } catch (error) {
    console.error("POST /api/alumni-agency/import error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" }, { status: 500 });
  }
}

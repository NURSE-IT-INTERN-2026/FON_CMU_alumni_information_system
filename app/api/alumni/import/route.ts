import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logImport, captureFileName, type ImportErrorRow } from "@/lib/import-log";
import { isXlsxFile, readExcelRows } from "@/lib/excel-import";
import { ensurePrimaryEducationBulk } from "@/lib/education-sync";
import { autoLinkPendingForAlumniBatch } from "@/lib/alumni-link";
import { mirrorAlumniHomeAddressToAgenciesBulk } from "@/lib/alumni-agency-home-sync";
import {
  fetchAlumniByStudentIds,
  partitionImport,
  chunkedCreateMany,
} from "@/lib/import-batch";
import {
  parseAlumniImportRow,
  alumniUpdatePayload,
  type AlumniImportRecord,
} from "@/lib/alumni-excel";

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
      return NextResponse.json({ error: "ไฟล์มีขนาดเกิน 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isXlsxFile(buffer)) {
      return NextResponse.json({ error: "ไฟล์ต้องเป็นนามสกุล .xlsx เท่านั้น" }, { status: 400 });
    }
    const rows = await readExcelRows(buffer);

    // 1) Parse + validate every row up front (invalid rows never reach the batch).
    const errors: ImportErrorRow[] = [];
    const records: AlumniImportRecord[] = [];
    for (let i = 0; i < rows.length; i++) {
      const { data, error } = parseAlumniImportRow(rows[i], i + 2);
      if (error) {
        errors.push(error);
        continue;
      }
      records.push(data!);
    }

    const ctx = { actorType: "ADMIN" as const, userId: session.user.id, userEmail: session.user.email, userRole: session.user.role };

    // 2) ONE findMany resolves which studentIds already exist (= update vs create).
    const alumniByStudentId = await fetchAlumniByStudentIds(records.map((r) => r.studentId));
    const existingByKey = new Map<string, string>();
    for (const [sid, a] of alumniByStudentId) existingByKey.set(`id:${sid}`, a.id);

    // 3) Partition create vs update in-memory, deduping within-file by studentId
    //    (last-wins — `studentId` is @unique, so two rows for one id collapse).
    const { toCreate, toUpdate } = partitionImport(
      records,
      existingByKey,
      (r) => [`id:${r.studentId}`],
      (r) => `id:${r.studentId}`,
    );

    let created = 0;
    let updated = 0;

    // 4) Chunked createMany (per-row fallback isolates a bad row) for new alumni.
    await chunkedCreateMany(toCreate, (r) => ({ ...r }), {
      createMany: (payloads) => prisma.alumni.createMany({ data: payloads as never }),
      createOne: (payload) => prisma.alumni.create({ data: payload as never }),
      onCreated: () => {
        created++;
      },
      onError: (r, e) => {
        console.error("Import create row error:", e);
        errors.push({ row: -1, message: `ไม่สามารถนำเข้า ${r.studentId}: ${e instanceof Error ? e.message : "ข้อผิดพลาด"}` });
      },
    });

    // Re-fetch the created alumni (ids + snapshot) — also filters out any that
    // failed in the create fallback, so side-effects only run on real creates.
    const createdStudentIds = toCreate.map((r) => r.studentId);
    const createdAlumni = createdStudentIds.length
      ? await prisma.alumni.findMany({
          where: { studentId: { in: createdStudentIds } },
          select: { id: true, studentId: true, prefix: true, firstName: true, lastName: true, homeAddress: true, degreeLevel: true, graduationYear: true, major: true, cohort: true },
        })
      : [];

    // 5) Per-row update for matched alumni (non-uniform payload ⇒ 1 op/row; the
    //    bulk read in step 2 already removed the per-row existence probe).
    for (const { row, existingId } of toUpdate) {
      try {
        // alumniUpdatePayload writes the 8 core fields unconditionally and the 4
        // export-only fields only when the row provided them — so a legacy import
        // (which omits those columns) never blanks an alumni's existing
        // major/graduationYear/birthDate/remarks.
        await prisma.alumni.update({
          where: { id: existingId },
          data: alumniUpdatePayload(row) as never,
        });
        updated++;
      } catch (e) {
        console.error("Import update row error:", e);
        errors.push({ row: -1, message: `ไม่สามารถอัปเดต ${row.studentId}: ${e instanceof Error ? e.message : "ข้อผิดพลาด"}` });
      }
    }

    // 6) Bulk side-effects for the created partition (the old per-row cascade):
    //    primary Education row, then mirror homeAddress onto linked agencies, then
    //    auto-link any pre-existing pending rows across the 6 related entities.
    await ensurePrimaryEducationBulk(
      createdAlumni.map((a) => ({
        alumniId: a.id,
        studentId: a.studentId,
        degreeLevel: a.degreeLevel,
        graduationYear: a.graduationYear,
        major: a.major,
        cohort: a.cohort,
        firstName: a.firstName,
        lastName: a.lastName,
      })),
    );

    // Mirror homeAddress onto linked agency rows for EVERY written alumni (created
    // + updated) — one findMany across all their studentIds.
    const addressesByStudentId = new Map<string, string | null>();
    for (const r of [...toCreate, ...toUpdate.map((t) => t.row)]) {
      addressesByStudentId.set(r.studentId, r.homeAddress);
    }
    await mirrorAlumniHomeAddressToAgenciesBulk({ addressesByStudentId });

    // A freshly created alumni is now canonical — link any pre-existing pending
    // rows across the 6 related entities (no-op for most new alumni; one batch
    // probe instead of 6 probes per alumni).
    if (createdAlumni.length > 0) {
      await autoLinkPendingForAlumniBatch({
        alumniList: createdAlumni.map((a) => ({
          alumniId: a.id,
          studentId: a.studentId,
          prefix: a.prefix,
          firstName: a.firstName,
          lastName: a.lastName,
          homeAddress: a.homeAddress,
        })),
        ctx,
        tx: prisma,
      });
    }

    const imported = created + updated;
    await logImport({
      ctx,
      resource: "alumni",
      fileName: captureFileName(file),
      attempted: rows.length,
      created,
      updated,
      failed: errors.length,
      errors,
    });

    return NextResponse.json({ imported, skipped: 0, errors });
  } catch (error) {
    console.error("POST /api/alumni/import error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูลศิษย์เก่า" }, { status: 500 });
  }
}

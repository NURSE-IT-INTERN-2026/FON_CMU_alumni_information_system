import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logImport, type ImportedRecord } from "@/lib/import-log";
import { bustCache, bustCachePrefix } from "@/lib/cache";
import {
  fetchCmuGraduatesLive,
  diffCmuGraduates,
  type CmuGraduate,
} from "@/lib/cmu-registrar";

/**
 * CMU Registrar materialization endpoint — the ONLY place the app still calls
 * the registrar LIVE. Powers the "การดึงข้อมูล" page:
 *   GET  /api/cmu-alumni/sync  → compare local `cmu_graduates` vs remote
 *                                (auto-run on page load).
 *   POST /api/cmu-alumni/sync  → materialize the full remote set into
 *                                `cmu_graduates` (the ดึงข้อมูล button).
 *
 * Auth: a valid admin/superadmin session (`checkWritePermission`), OR the
 * `CMU_SYNC_SECRET` bearer token so an external cron can refresh the table.
 */
async function authorize(request: Request): Promise<
  | { ok: true; session: Awaited<ReturnType<typeof getSession>> }
  | { ok: false; response: NextResponse }
> {
  const secret = process.env.CMU_SYNC_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) {
    return { ok: true, session: null };
  }
  const permErr = await checkWritePermission();
  if (permErr) return { ok: false, response: permErr };
  return { ok: true, session: await getSession() };
}

/** The 11 CMU fields persisted per record (no studentId / bookkeeping here). */
function rowFields(g: CmuGraduate) {
  return {
    nameTh: (g.name_th ?? "").trim(),
    surnameTh: (g.surname_th ?? "").trim(),
    birthday: g.birthday ?? "",
    levelId: g.level_id ?? "",
    majorNameTh: (g.major_name_th ?? "").trim(),
    gradYear: g.grad_year ?? "",
    sexId: g.sex_id || null,
    cmuitAccount: g.cmuitaccount || null,
    nameEn: g.name_en || null,
    surnameEn: g.surname_en || null,
    gradDate: g.grad_date || null,
  };
}

const CHUNK_SIZE = 500;

// GET — compare local vs remote (studentId-set + count; excludes local-not-CMU
// data by design: local-only alumni are not in `cmu_graduates`).
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  try {
    const [remote, localRows] = await Promise.all([
      fetchCmuGraduatesLive(),
      prisma.cmuGraduate.findMany({
        where: { deletedAt: null },
        select: { studentId: true, updatedAt: true },
      }),
    ]);
    const diff = diffCmuGraduates(
      remote,
      localRows.map((r) => r.studentId),
    );
    const lastSyncedAt = localRows.length
      ? localRows.reduce(
          (max, r) => (r.updatedAt > max ? r.updatedAt : max),
          localRows[0].updatedAt,
        )
      : null;
    return NextResponse.json({ ...diff, lastSyncedAt });
  } catch (error) {
    console.error("GET /api/cmu-alumni/sync error:", error);
    return NextResponse.json(
      { error: "ไม่สามารถติดต่อระบบทะเบียนเพื่อตรวจสอบได้ กรุณาลองใหม่ภายหลัง" },
      { status: 502 },
    );
  }
}

// POST — materialize the full remote registrar set into cmu_graduates (chunked
// upserts so existing rows refresh stale fields; createMany would skip them).
// Does NOT auto-soft-delete registrar-removed rows — reported via GET's
// removedCount only (keeps the table a faithful superset).
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  try {
    const remote = await fetchCmuGraduatesLive();
    let created = 0;
    let updated = 0;
    const records: ImportedRecord[] = [];

    for (let i = 0; i < remote.length; i += CHUNK_SIZE) {
      const slice = remote.slice(i, i + CHUNK_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const g of slice) {
          const sid = String(g.student_id ?? "").trim();
          if (!sid) continue;
          const result = await tx.cmuGraduate.upsert({
            where: { studentId: sid },
            create: { studentId: sid, ...rowFields(g) },
            update: { ...rowFields(g), deletedAt: null },
          });
          const op =
            result.createdAt.getTime() === result.updatedAt.getTime()
              ? "created"
              : "updated";
          if (op === "created") created++;
          else updated++;
          if (records.length < 500) {
            records.push({
              id: sid,
              name: `${g.name_th ?? ""} ${g.surname_th ?? ""}`.trim(),
              op,
            });
          }
        }
      });
    }

    if (auth.session) {
      await logImport({
        ctx: {
          actorType: "ADMIN",
          userId: auth.session.user.id,
          userEmail: auth.session.user.email,
          userRole: auth.session.user.role,
        },
        resource: "cmu_alumni",
        fileName: null,
        attempted: remote.length,
        created,
        updated,
        failed: 0,
        records,
        errors: [],
      });
    }

    // The dashboard + alumni-count payloads are 60s-TTL cached; bust so the new
    // counts land immediately after a sync.
    bustCache("dashboard");
    bustCachePrefix("alumni");

    return NextResponse.json({
      upserted: created + updated,
      created,
      updated,
      remoteCount: remote.length,
    });
  } catch (error) {
    console.error("POST /api/cmu-alumni/sync error:", error);
    return NextResponse.json(
      { error: "ดึงข้อมูลจากระบบทะเบียนไม่สำเร็จ กรุณาลองใหม่ภายหลัง" },
      { status: 502 },
    );
  }
}

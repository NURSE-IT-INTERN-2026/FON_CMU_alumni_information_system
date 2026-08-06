import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, constantTimeEqual } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { fetchCmuGraduatesLive, diffCmuGraduates } from "@/lib/cmu-registrar";
import { materializeCmuGraduates } from "@/lib/cmu-sync-job";

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
 *
 * POST delegates to `materializeCmuGraduates` (`lib/cmu-sync-job.ts`), shared
 * with the in-process monthly scheduler (`lib/cmu-scheduler.ts`, armed at boot
 * from `instrumentation.ts`) — one code path for manual + scheduled sync.
 */
async function authorize(request: Request): Promise<
  | { ok: true; session: Awaited<ReturnType<typeof getSession>> }
  | { ok: false; response: NextResponse }
> {
  const secret = process.env.CMU_SYNC_SECRET;
  if (secret && constantTimeEqual(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return { ok: true, session: null };
  }
  const permErr = await checkWritePermission();
  if (permErr) return { ok: false, response: permErr };
  return { ok: true, session: await getSession() };
}

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
// removedCount only (keeps the table a faithful superset). Delegates to the
// shared `materializeCmuGraduates` (also used by the monthly scheduler).
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await materializeCmuGraduates(
      auth.session
        ? {
            actorType: "ADMIN",
            userId: auth.session.user.id,
            userEmail: auth.session.user.email,
            userRole: auth.session.user.role,
          }
        : { actorType: "SYSTEM" },
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/cmu-alumni/sync error:", error);
    return NextResponse.json(
      { error: "ดึงข้อมูลจากระบบทะเบียนไม่สำเร็จ กรุณาลองใหม่ภายหลัง" },
      { status: 502 },
    );
  }
}

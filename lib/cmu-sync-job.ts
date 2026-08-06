/**
 * CMU Registrar materialization — the shared, reusable job (SERVER-ONLY — imports
 * Prisma). Extracted from `POST /api/cmu-alumni/sync` so the HTTP route and the
 * in-process monthly scheduler (`lib/cmu-scheduler.ts`) run the SAME code path.
 *
 * `materializeCmuGraduates(ctx)` fetches the full live registrar set and upserts
 * it into `cmu_graduates` (chunked 500-row transactions so existing rows refresh
 * stale fields — `createMany` would skip them), then writes one IMPORT activity
 * log and busts the dashboard/alumni caches. It does NOT soft-delete
 * registrar-removed rows — `cmu_graduates` is kept a faithful superset (removed
 * rows are reported only via the GET compare's `removedCount`). Throws on
 * registrar failure; the caller decides how to surface it.
 *
 * This is the ONLY place the app still calls the registrar LIVE (besides the
 * route's GET compare, which calls `fetchCmuGraduatesLive` directly).
 */
import prisma from "@/lib/prisma";
import { logImport } from "@/lib/import-log";
import { bustCache, bustCachePrefix } from "@/lib/cache";
import { fetchCmuGraduatesLive, type CmuGraduate } from "@/lib/cmu-registrar";
import type { LogContext } from "@/lib/activity-log";

/** The 11 CMU fields persisted per record (no studentId / bookkeeping here). */
export function rowFields(g: CmuGraduate) {
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

/** Upsert chunk size — keeps each multi-row INSERT under Postgres' ~65535 bind-param cap. */
const CHUNK_SIZE = 500;

export interface MaterializeResult {
  upserted: number;
  created: number;
  updated: number;
  remoteCount: number;
}

/**
 * Fetch the full remote registrar set and upsert it into `cmu_graduates`, then
 * log + bust caches. `ctx` controls the actor on the IMPORT log — admin session
 * for the manual UI path, `{ actorType: "SYSTEM" }` for the bearer/cron and
 * in-process scheduler paths. Returns the same shape the POST route returns.
 */
export async function materializeCmuGraduates(ctx: LogContext): Promise<MaterializeResult> {
  const remote = await fetchCmuGraduatesLive();
  let created = 0;
  let updated = 0;

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
          result.createdAt.getTime() === result.updatedAt.getTime() ? "created" : "updated";
        if (op === "created") created++;
        else updated++;
      }
    });
  }

  await logImport({
    ctx,
    resource: "cmu_alumni",
    fileName: null,
    attempted: remote.length,
    created,
    updated,
    failed: 0,
    errors: [],
  });

  // The dashboard + alumni-count payloads are 60s-TTL cached; bust so the new
  // counts land immediately after a sync.
  bustCache("dashboard");
  bustCachePrefix("alumni");

  return { upserted: created + updated, created, updated, remoteCount: remote.length };
}

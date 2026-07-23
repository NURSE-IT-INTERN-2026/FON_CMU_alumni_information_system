/**
 * Shared BATCHED-IMPORT helpers — cut the Prisma "Total Operations" query count
 * of the Excel `/import` routes. SERVER-ONLY: imports `@/lib/prisma`, so it must
 * never be imported by a client module.
 *
 * Why this exists: the quota is a query-COUNT limit (the DB hit `planLimitReached`
 * once). Each import route used to issue ~3–16 queries PER ROW (per-row
 * `findUnique` link resolve + `findFirst` dedup + `create`/`update`, plus alumni
 * side-effects). The levers that reduce query COUNT are bulk reads (N finds → 1
 * `findMany`), `createMany` (N creates → 1 query), and dropping redundant per-row
 * probes. (`$transaction` does NOT cut the count — each query inside still counts.)
 *
 * The pure helpers below are split out so the partition/dedup/match logic is
 * unit-testable with no database. The DB helpers are thin wrappers reused by all
 * 7 import routes.
 */
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import type { AlumniLinkResult } from "@/lib/alumni-link";

/**
 * Chunk size for every bulk write/read in this module (matches the CMU-sync
 * route). Prisma's `createMany` emits one multi-row `INSERT`; Postgres caps
 * ~65535 bind parameters per statement, so an unchunked multi-thousand-row insert
 * would fail. 500 rows × ~tens of columns stays well under the limit.
 */
export const IMPORT_CHUNK_SIZE = 500;

/** Split an array into fixed-size chunks. */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** A resolved person identity (the columns `buildAlumniEntityMatchWhere` keys on). */
export interface Identity {
  studentId: string | null;
  pendingStudentId: string | null;
  firstName: string | null;
  lastName: string | null;
}

/** `"name:<firstName>|<lastName>"` — the id-less-row identity key. */
export function nameIdentityKey(i: Identity): string {
  return `name:${i.firstName ?? ""}|${i.lastName ?? ""}`;
}

/**
 * The single identity key an EXISTING row is matched by — mirrors
 * `buildAlumniEntityMatchWhere`'s resolution priority:
 *   has studentId        → `id:<studentId>`
 *   else has pendingId   → `pid:<pendingStudentId>`
 *   else (id-less)       → `name:<first>|<last>`
 */
export function existingIdentityKey(i: Identity): string {
  if (i.studentId) return `id:${i.studentId}`;
  if (i.pendingStudentId) return `pid:${i.pendingStudentId}`;
  return nameIdentityKey(i);
}

/**
 * The candidate identity keys an INCOMING row can match an existing row by
 * (priority order). An id'd or pending incoming row may ALSO match an existing
 * id-less row by name (the OR name clause in `buildAlumniEntityMatchWhere`),
 * so the name key is ALWAYS appended — even when both names are null (e.g. an
 * alumni-agency row that carries only an englishName matches existing id-less
 * rows whose names are also null). For the 5 person-entities the names are
 * always present, so this is a no-op there.
 */
export function incomingIdentityKeys(i: Identity): string[] {
  const keys: string[] = [];
  if (i.studentId) keys.push(`id:${i.studentId}`);
  else if (i.pendingStudentId) keys.push(`pid:${i.pendingStudentId}`);
  keys.push(nameIdentityKey(i));
  return keys;
}

/**
 * Build the existing-rows lookup map from ONE bulk `findMany` result.
 * Each existing row is registered under `compositeKeyOf(row)` (which the caller
 * builds as `existingIdentityKey(identity) + "|" + <naturalKey>`). Returns a map
 * keyed by composite key → existing row id. Pure.
 */
export function buildExistingKeyMap<E>(
  existingRows: E[],
  compositeKeyOf: (e: E) => string,
  idOf: (e: E) => string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of existingRows) {
    map.set(compositeKeyOf(e), idOf(e));
  }
  return map;
}

/**
 * Partition parsed rows into `{ toCreate, toUpdate }`, mirroring what the old
 * per-row `findFirst`+`create`/`update` did — but in-memory.
 *
 * - `candidateKeysOf(row)` returns the composite keys the row could match an
 *   existing row by (`incomingIdentityKeys(identity)` each `+ "|" + naturalKey`).
 * - `primaryCompositeOf(row)` is the first candidate, used for within-file dedup.
 *
 * Within-file dedup (last-wins) runs BEFORE partitioning. This is load-bearing:
 * the old per-row loop collapsed same-key duplicates (first row created, later
 * rows found & updated it → last value persisted). `createMany` does not, so we
 * collapse identical composite keys here — one create with the last value, which
 * leaves the same end state in the DB. Pure.
 */
export function partitionImport<E>(
  rows: E[],
  existingByKey: Map<string, string>,
  candidateKeysOf: (row: E) => string[],
  primaryCompositeOf: (row: E) => string,
): { toCreate: E[]; toUpdate: { row: E; existingId: string }[] } {
  // Within-file dedup, last-wins by primary composite key.
  const dedup = new Map<string, E>();
  for (const row of rows) dedup.set(primaryCompositeOf(row), row);

  const toCreate: E[] = [];
  const toUpdate: { row: E; existingId: string }[] = [];
  for (const row of dedup.values()) {
    const candidates = candidateKeysOf(row);
    let existingId: string | undefined;
    for (const c of candidates) {
      existingId = existingByKey.get(c);
      if (existingId) break;
    }
    if (existingId) toUpdate.push({ row, existingId });
    else toCreate.push(row);
  }
  return { toCreate, toUpdate };
}

/**
 * Resolve an attempted studentId against a precomputed `alumniByStudentId` map —
 * the bulk sibling of `resolveAlumniLink`. Same three branches:
 *   blank  → both null
 *   hit    → `studentId` = the id, `pendingStudentId` = null, `major` back-filled
 *   miss   → `studentId` = null, `pendingStudentId` = the attempted id
 * Pure. (Does NOT filter soft-deleted alumni, matching `resolveAlumniLink`'s
 * `findUnique` which returns soft-deleted rows too.)
 */
export function linkResultFromMap(
  attemptedStudentId: string | null | undefined,
  currentMajor: string | null,
  alumniByStudentId: Map<string, { id: string; major: string | null }>,
): AlumniLinkResult {
  const attempted = (attemptedStudentId ?? "").trim();
  if (!attempted) {
    return { studentId: null, pendingStudentId: null, major: currentMajor, linked: false };
  }
  const linked = alumniByStudentId.get(attempted);
  if (linked) {
    return { studentId: attempted, pendingStudentId: null, major: linked.major ?? currentMajor, linked: true };
  }
  return { studentId: null, pendingStudentId: attempted, major: currentMajor, linked: false };
}

/**
 * ONE `findMany` by `studentId IN [...]` → `Map<studentId, {id, major}>`. Used by
 * all 7 import routes to replace the per-row `findUnique` link resolve. Distinct
 * ids are chunked to keep the `IN` clause bounded. Returns an empty map when no
 * ids are supplied.
 */
export async function fetchAlumniByStudentIds(
  studentIds: (string | null | undefined)[],
  tx: Prisma.TransactionClient = prisma,
): Promise<Map<string, { id: string; major: string | null }>> {
  const map = new Map<string, { id: string; major: string | null }>();
  const distinct = [...new Set(studentIds.map((s) => (s ?? "").trim()).filter(Boolean))];
  if (distinct.length === 0) return map;
  for (const slice of chunk(distinct, IMPORT_CHUNK_SIZE)) {
    const rows = await tx.alumni.findMany({
      where: { studentId: { in: slice } },
      select: { id: true, studentId: true, major: true },
    });
    for (const r of rows) map.set(r.studentId, { id: r.id, major: r.major });
  }
  return map;
}

/** Models that support the person-entity / agency idempotent import match. */
export type ImportableEntityModel =
  | "award"
  | "association"
  | "graduateCommittee"
  | "potential"
  | "modelRepresentative"
  | "alumniAgency";

/**
 * Bulk-find existing rows that could match ANY row in the file — ≤2 `findMany`
 * internally (kept as one OR query; the result set is bounded by the people in
 * the file). The WHERE mirrors `buildAlumniEntityMatchWhere`/`alumniAgencyMatchWhere`:
 *   - linked `studentId IN linkedStudentIds`, OR
 *   - pending `pendingStudentId IN pendingStudentIds`, OR
 *   - id-less name-pair fallback (`studentId:null AND pendingStudentId:null AND
 *     (firstName,lastName) ∈ namePairs`)
 * scoped to non-deleted rows. Returns `[]` when there is nothing to look up.
 */
export async function fetchExistingEntityRows<E>(args: {
  model: ImportableEntityModel;
  linkedStudentIds: string[];
  pendingStudentIds: string[];
  namePairs: { firstName: string | null; lastName: string | null }[];
  select: Record<string, true>;
  tx?: Prisma.TransactionClient;
}): Promise<E[]> {
  const { model, linkedStudentIds, pendingStudentIds, namePairs, select } = args;
  const or: Record<string, unknown>[] = [];
  if (linkedStudentIds.length) or.push({ studentId: { in: [...new Set(linkedStudentIds)] } });
  if (pendingStudentIds.length) or.push({ pendingStudentId: { in: [...new Set(pendingStudentIds)] } });
  for (const p of namePairs) {
    or.push({ firstName: p.firstName, lastName: p.lastName, studentId: null, pendingStudentId: null });
  }
  if (or.length === 0) return [];
  const where = { deletedAt: null, OR: or } as Record<string, unknown>;

  const client = args.tx ?? prisma;
  switch (model) {
    case "award":
      return (await client.award.findMany({ where, select: select as never })) as E[];
    case "association":
      return (await client.association.findMany({ where, select: select as never })) as E[];
    case "graduateCommittee":
      return (await client.graduateCommittee.findMany({ where, select: select as never })) as E[];
    case "potential":
      return (await client.potential.findMany({ where, select: select as never })) as E[];
    case "modelRepresentative":
      return (await client.modelRepresentative.findMany({ where, select: select as never })) as E[];
    case "alumniAgency":
      return (await client.alumniAgency.findMany({ where, select: select as never })) as E[];
    default:
      return [] as E[];
  }
}

/**
 * Chunked `createMany` with per-row fallback — the shared write path for the
 * import routes. For each chunk: try `ops.createMany(payloads)` (one `INSERT`);
 * on throw, fall back to `ops.createOne(payload)` per row, calling `ops.onError`
 * for failures so ONE bad row can't fail the whole import (the old per-row error
 * contract). `createMany` is atomic (one `INSERT`), so on throw nothing was
 * inserted and the per-row fallback safely re-creates every row. `onCreated` is
 * called once per successfully-written row (for counting + the IMPORT record list).
 */
export async function chunkedCreateMany<E>(
  rows: E[],
  buildPayload: (row: E) => Record<string, unknown>,
  ops: {
    createMany: (payloads: Record<string, unknown>[]) => Promise<unknown>;
    createOne: (payload: Record<string, unknown>) => Promise<unknown>;
    onCreated: (row: E) => void;
    onError: (row: E, err: unknown) => void;
  },
): Promise<void> {
  for (const batch of chunk(rows, IMPORT_CHUNK_SIZE)) {
    const payloads = batch.map(buildPayload);
    try {
      await ops.createMany(payloads);
      for (const row of batch) ops.onCreated(row);
    } catch {
      for (let i = 0; i < batch.length; i++) {
        try {
          await ops.createOne(payloads[i]);
          ops.onCreated(batch[i]);
        } catch (e) {
          ops.onError(batch[i], e);
        }
      }
    }
  }
}

import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { logActivity, type LogContext } from "@/lib/activity-log";
import { recordFieldChanges, type FieldChange } from "@/lib/field-changes";

/**
 * There are TWO independent `homeAddress` columns that share a name:
 *   - `AlumniAgency.homeAddress` (ที่อยู่บ้าน — the agency form field)
 *   - `Alumni.homeAddress`      (ที่อยู่ปัจจุบัน — what the all-alumni table reads)
 * This module keeps them in sync: an agency homeAddress change is pushed onto the
 * linked `Alumni` row so it shows up in the all-alumni table, and the change is
 * recorded as an `alumni`-scoped field change so the orange indicator fires.
 */

/**
 * Should the agency homeAddress be pushed onto the linked Alumni? Pure (no DB) so
 * the policy is unit-testable. Rules:
 *   - unlinked/pending row (no studentId) → never
 *   - empty/whitespace agency address → never (clearing the agency address must
 *     NOT clear the alumni address; an alumni can have several agency rows)
 *   - value identical to the alumni's current address → never
 */
export function shouldSyncAgencyHomeAddress(args: {
  studentId: string | null;
  agencyHomeAddress: string | null | undefined;
  alumniHomeAddress: string | null;
}): boolean {
  if (!args.studentId) return false;
  const next = args.agencyHomeAddress?.trim() || null;
  if (!next) return false;
  return (args.alumniHomeAddress ?? null) !== next;
}

/**
 * Sync an alumni-agency row's `homeAddress` onto the linked `Alumni.homeAddress`.
 * No-op when unlinked, empty, or unchanged. On a real change: updates the alumni
 * row, then writes an `alumni`-scoped field change (orange indicator on the
 * all-alumni table + alumni profile) plus an alumni `UPDATE` activity log (data-
 * logs tab entry), linked via `activityLogId` so one edit = one timeline entry.
 * Logging is fire-and-forget (`recordFieldChanges` swallows errors).
 */
export async function syncAgencyHomeAddressToAlumni(args: {
  ctx: LogContext;
  studentId: string | null;
  agencyHomeAddress: string | null;
  reason?: string | null;
}): Promise<void> {
  if (!args.studentId) return;
  const next = args.agencyHomeAddress?.trim() || null;
  if (!next) return;

  const alumni = await prisma.alumni.findUnique({
    where: { studentId: args.studentId },
    select: { id: true, homeAddress: true },
  });
  if (!alumni) return; // FK present but the alumni row is gone — defensive

  await applyAgencyHomeAddressToAlumni(args.ctx, alumni.id, alumni.homeAddress ?? null, next, args.reason ?? null);
}

/**
 * Bulk sibling of `syncAgencyHomeAddressToAlumni` for the alumni-agency IMPORT:
 * push each linked agency row's `homeAddress` onto its alumni. ONE `findMany`
 * fetches the alumni rows for the whole file (instead of N `findUnique`), the
 * per-alumni diff is computed in-memory via `shouldSyncAgencyHomeAddress`, and
 * only alumni whose address actually changes are written — each with its own
 * `UPDATE` activity log + `alumni`-scoped field-change row (the orange indicator
 * + data-logs entry), identical to the per-row function. Empty agency addresses
 * are skipped (never clears — an alumni can have several agency rows).
 */
export async function syncAgencyHomeAddressToAlumniBulk(args: {
  ctx: LogContext;
  addressesByStudentId: Map<string, string | null>;
  reason?: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const tx = args.tx ?? prisma;
  const ids = [...args.addressesByStudentId.keys()];
  if (ids.length === 0) return;

  const alumniRows = await tx.alumni.findMany({
    where: { studentId: { in: ids } },
    select: { id: true, studentId: true, homeAddress: true },
  });
  for (const alumni of alumniRows) {
    const agencyHomeAddress = args.addressesByStudentId.get(alumni.studentId) ?? null;
    const next = agencyHomeAddress?.trim() || null;
    if (!next) continue;
    const prev = alumni.homeAddress ?? null;
    if (prev === next) continue;
    await applyAgencyHomeAddressToAlumni(args.ctx, alumni.id, prev, next, args.reason ?? null, tx);
  }
}

/** Shared write+log tail: update the alumni homeAddress + one UPDATE log + field-change row. */
async function applyAgencyHomeAddressToAlumni(
  ctx: LogContext,
  alumniId: string,
  prev: string | null,
  next: string,
  reason: string | null,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  await tx.alumni.update({ where: { id: alumniId }, data: { homeAddress: next } });

  const changes: FieldChange[] = [{ field: "homeAddress", from: prev, to: next }];
  const logId = await logActivity(
    ctx,
    "UPDATE",
    "alumni",
    alumniId,
    { source: "alumni_agency_sync", changes },
    reason,
    tx,
  );
  await recordFieldChanges({
    resourceType: "alumni",
    resourceId: alumniId,
    changes,
    actor:
      ctx.actorType === "ADMIN"
        ? { actorType: "ADMIN", userId: ctx.userId, actorName: ctx.userEmail }
        : { actorType: "ALUMNI", alumniId: ctx.alumniId, actorName: ctx.alumniName },
    reason,
    activityLogId: logId,
  });
}

/**
 * REVERSE direction — the second half of homeAddress unification. When the
 * alumni's own `homeAddress` is edited (profile / admin / import), mirror the
 * new value onto every linked `AlumniAgency` row so the agency form input and
 * the agency-table column stay current. `Alumni.homeAddress` is the single
 * source of truth; linked agency rows REFLECT it.
 *
 * Unlike `shouldSyncAgencyHomeAddress` (agency→alumni, which skips empty to
 * protect an alumni that has several agency rows), the alumni→agency mirror
 * DOES propagate a clear — "one home address per person" means clearing the
 * alumni address clears the linked agencies too.
 *
 * No activity log / field-change rows here: the alumni write route already logs
 * the `homeAddress` change under `resourceType:"alumni"`, and the agency table
 * reads that alumni-scoped history for linked rows — so the orange indicator
 * fires from the route's own logging. This function only keeps the agency
 * COLUMN in sync (so the agency form input is current).
 */
export function shouldMirrorAlumniHomeAddress(args: {
  agencyHomeAddress: string | null;
  alumniHomeAddress: string | null;
}): boolean {
  const next = args.alumniHomeAddress?.trim() || null;
  return (args.agencyHomeAddress ?? null) !== next;
}

export async function mirrorAlumniHomeAddressToAgencies(args: {
  studentId: string;
  alumniHomeAddress: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const tx = args.tx ?? prisma;
  const next = args.alumniHomeAddress?.trim() || null; // propagate clears

  const rows = await tx.alumniAgency.findMany({
    where: { studentId: args.studentId, deletedAt: null },
    select: { id: true, homeAddress: true },
  });
  if (rows.length === 0) return;

  const changed = rows.filter((r) => shouldMirrorAlumniHomeAddress({ agencyHomeAddress: r.homeAddress, alumniHomeAddress: next }));
  if (changed.length === 0) return;

  await tx.alumniAgency.updateMany({
    where: { id: { in: changed.map((r) => r.id) } },
    data: { homeAddress: next },
  });
}

/**
 * Bulk sibling of `mirrorAlumniHomeAddressToAgencies` for the alumni IMPORT:
 * mirror the alumni `homeAddress` onto every linked agency row, across the whole
 * file in ONE `findMany` (instead of N). Groups linked agency rows by studentId;
 * for each studentId whose desired address differs from at least one agency row,
 * ONE `updateMany` writes the new value. Propagates clears ("one home address per
 * person"), same as the per-row mirror. No activity log / field-change rows here
 * (the alumni write route already logged the `homeAddress` change — this only
 * keeps the agency COLUMN in sync).
 */
export async function mirrorAlumniHomeAddressToAgenciesBulk(args: {
  addressesByStudentId: Map<string, string | null>;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const tx = args.tx ?? prisma;
  const studentIds = [...args.addressesByStudentId.keys()];
  if (studentIds.length === 0) return;

  const rows = await tx.alumniAgency.findMany({
    where: { studentId: { in: studentIds }, deletedAt: null },
    select: { id: true, studentId: true, homeAddress: true },
  });
  if (rows.length === 0) return;

  // Collect changed agency row ids per studentId (each studentId gets one value).
  // The `where: studentId IN …` guarantees every row has a non-null studentId.
  const changedByStudent = new Map<string, { ids: string[]; next: string | null }>();
  for (const r of rows) {
    const sid = r.studentId;
    if (!sid) continue;
    const next = (args.addressesByStudentId.get(sid) ?? "").trim() || null;
    if (!shouldMirrorAlumniHomeAddress({ agencyHomeAddress: r.homeAddress, alumniHomeAddress: next })) continue;
    let entry = changedByStudent.get(sid);
    if (!entry) {
      entry = { ids: [], next };
      changedByStudent.set(sid, entry);
    }
    entry.ids.push(r.id);
  }
  for (const { ids, next } of changedByStudent.values()) {
    await tx.alumniAgency.updateMany({ where: { id: { in: ids } }, data: { homeAddress: next } });
  }
}

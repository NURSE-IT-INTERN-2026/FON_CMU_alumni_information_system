import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { logActivity, type LogContext } from "@/lib/activity-log";
import {
  TRACKED_FIELDS,
  computeFieldChanges,
  recordFieldChanges,
  type FieldChange,
} from "@/lib/field-changes";

/**
 * Shared "link-or-flag" logic for the alumni-related entities (Award,
 * Association, GraduateCommittee, Potential, ModelRepresentative) — mirrors
 * what `app/api/alumni-agency/import/route.ts` does inline. SERVER-ONLY: this
 * imports `@/lib/prisma`, so it must never be imported by a client module.
 *
 * The pattern: when importing a row whose `studentId` has NO matching `Alumni`,
 * we FLAG the row via `pendingStudentId` instead of auto-creating a stub alumni
 * (the old `ensureAlumni` behavior). `studentId` is a FK to `Alumni.studentId`,
 * so it must stay null while the id is only pending.
 */

export interface AlumniLinkResult {
  /** The FK value to write: the matched alumni's studentId, or null. */
  studentId: string | null;
  /** The attempted id when no Alumni matched; null otherwise. */
  pendingStudentId: string | null;
  /** Major copied from the matched alumni (null if not matched / no major). */
  major: string | null;
  /** True when a real Alumni was found and linked. */
  linked: boolean;
}

/**
 * Resolve an attempted studentId against EXISTING Alumni only — NO stub
 * creation. This is the drop-in replacement for `ensureAlumni` in import routes.
 *
 * - hit  → `studentId` = the matched alumni's id, `pendingStudentId` = null,
 *          `major` back-filled from the alumni.
 * - miss → `studentId` = null, `pendingStudentId` = the attempted id.
 * - blank → both null (an id-less row).
 *
 * Accepts an optional transaction client `tx` so a caller already inside a
 * `prisma.$transaction` can reuse the same connection; the import routes are
 * not transactional today, so they pass nothing (defaults to the shared client).
 */
export async function resolveAlumniLink(
  attemptedStudentId: string | null | undefined,
  currentMajor: string | null = null,
  tx: Prisma.TransactionClient = prisma,
): Promise<AlumniLinkResult> {
  const attempted = (attemptedStudentId ?? "").trim();
  if (!attempted) {
    return { studentId: null, pendingStudentId: null, major: currentMajor, linked: false };
  }
  const linked = await tx.alumni.findUnique({ where: { studentId: attempted } });
  if (linked) {
    return {
      studentId: linked.studentId,
      pendingStudentId: null,
      major: linked.major ?? currentMajor,
      linked: true,
    };
  }
  return {
    studentId: null,
    pendingStudentId: attempted,
    major: currentMajor,
    linked: false,
  };
}

/**
 * Build the Prisma `where` for finding an existing ACTIVE row to UPDATE on
 * (re-)import — generalized from `alumniAgencyMatchWhere`
 * (`lib/alumni-agency-parse.ts`). Matches by the resolved id (linked
 * `studentId`, or `pendingStudentId`) OR by firstName+lastName ONLY for id-less
 * rows. That name fallback stops a re-import from duplicating when data that
 * now carries an id lands over name-only records.
 *
 * The name clause is restricted to id-less rows (`studentId: null,
 * pendingStudentId: null`) so two DIFFERENT id'd people who happen to share a
 * name are never merged into one row.
 *
 * Callers that allow the same person to hold multiple distinct rows (e.g. an
 * Award per year, an Association membership per year) should AND the entity's
 * natural-key columns onto this where: `{ AND: [ buildAlumniEntityMatchWhere(…), { awardName, year } ] }`.
 */
export function buildAlumniEntityMatchWhere(input: {
  studentId: string | null;
  pendingStudentId: string | null;
  firstName: string | null;
  lastName: string | null;
}): Record<string, unknown> {
  const idClause = input.studentId
    ? { studentId: input.studentId }
    : input.pendingStudentId
      ? { pendingStudentId: input.pendingStudentId }
      : null;
  return {
    deletedAt: null,
    OR: [
      ...(idClause ? [idClause] : []),
      {
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        studentId: null,
        pendingStudentId: null,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Auto-link: when an Alumni becomes canonical (admin create / import /
// create-with-related, or signup approve), flip every pending row whose
// `pendingStudentId` matches the alumni's `studentId` into a real FK link:
// set `studentId`, clear `pendingStudentId`, overwrite the row's name with the
// alumni's canonical name (alumni wins, only on diff), and — for `alumni_agency`
// rows only — backfill the alumni's `homeAddress` from the row when the alumni
// has none. Idempotent. See CLAUDE.md "Auto-link at canonicalization".
// ---------------------------------------------------------------------------

export type LinkEntityKind =
  | "award"
  | "association"
  | "graduate_committee"
  | "potential"
  | "model_representative"
  | "alumni_agency";

export interface AutoLinkSummary {
  studentId: string;
  alumniId: string;
  /** Rows whose FK was flipped (excludes no-ops). */
  linkedCount: number;
  perEntity: Record<LinkEntityKind, { flipped: number; renamed: number }>;
  /** True when an alumni_agency row's homeAddress was backfilled onto the alumni. */
  homeMigrated: boolean;
  /** The agency row id the homeAddress was migrated from (audit), else null. */
  homeMigratedFrom: string | null;
}

type PendingNameRow = {
  id: string;
  prefix: string | null;
  firstName: string | null;
  lastName: string | null;
  studentId: string | null;
};

type AgencyPendingRow = PendingNameRow & {
  homeAddress: string | null;
  updatedAt: Date;
};

/**
 * Pure: pick the alumni_agency row whose `homeAddress` should be migrated onto
 * an alumni whose own `homeAddress` is empty. Returns null when the alumni
 * already has an address, or no agency row carries a non-empty one. Among
 * non-empty rows, the most-recently-updated wins; ties break by `id` ascending
 * (deterministic). Self-contained (sorts internally) so it is unit-testable.
 */
export function pickHomeAddressMigrationCandidate(args: {
  alumniHomeAddress: string | null;
  agencyRows: AgencyPendingRow[];
}): { id: string; homeAddress: string } | null {
  if (args.alumniHomeAddress && args.alumniHomeAddress.trim()) return null;
  const sorted = [...args.agencyRows].sort((a, b) => {
    const byTime = b.updatedAt.getTime() - a.updatedAt.getTime(); // updatedAt desc
    if (byTime !== 0) return byTime;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // id asc
  });
  for (const row of sorted) {
    const value = row.homeAddress?.trim() || null;
    if (value) return { id: row.id, homeAddress: value };
  }
  return null;
}

/**
 * Pure: compute the FK-flip + alumni-wins name overwrite for one pending row.
 * `changes` is driven by `TRACKED_FIELDS[kind]` so only differing tracked
 * fields are logged (names on all 6; `studentId` on `alumni_agency` only — the
 * other 5 don't track `studentId`, so their FK flip produces no field-change
 * row, matching `create-with-related`).
 */
export function reconcilePendingRow(
  oldRow: PendingNameRow,
  alumniName: { prefix: string | null; firstName: string; lastName: string },
  studentId: string,
  kind: LinkEntityKind,
): { updateData: Record<string, unknown>; changes: FieldChange[] } {
  const newRow: Record<string, unknown> = {
    ...oldRow,
    studentId,
    pendingStudentId: null,
    prefix: alumniName.prefix,
    firstName: alumniName.firstName,
    lastName: alumniName.lastName,
  };
  const changes = computeFieldChanges(
    oldRow as unknown as Record<string, unknown>,
    newRow,
    TRACKED_FIELDS[kind],
  );
  const updateData: Record<string, unknown> = {
    studentId,
    pendingStudentId: null,
    prefix: alumniName.prefix,
    firstName: alumniName.firstName,
    lastName: alumniName.lastName,
  };
  return { updateData, changes };
}

function emptyPerEntity(): Record<LinkEntityKind, { flipped: number; renamed: number }> {
  return {
    award: { flipped: 0, renamed: 0 },
    association: { flipped: 0, renamed: 0 },
    graduate_committee: { flipped: 0, renamed: 0 },
    potential: { flipped: 0, renamed: 0 },
    model_representative: { flipped: 0, renamed: 0 },
    alumni_agency: { flipped: 0, renamed: 0 },
  };
}

/**
 * Link every pending row (across the 6 related entities) whose
 * `pendingStudentId === studentId` to this alumni: FK flip + clear
 * `pendingStudentId` + alumni-wins name overwrite + (agency only) one-time
 * `homeAddress` backfill onto the alumni. Idempotent.
 *
 * `tx` is REQUIRED (no default) — callers decide transactionality (pass `prisma`
 * when not inside a `$transaction`, a tx client when they are), matching
 * `recomputePrimaryEducation`. `dryRun` reports counts without writing or
 * logging (used by the backfill script's preview). Writes one `LINK` activity
 * log on the alumni + per-row `FieldChangeHistory` rows for the renames (linked
 * to it) — only when at least one row linked, never in dryRun.
 */
export async function autoLinkPendingForAlumni(args: {
  alumniId: string;
  studentId: string;
  ctx: LogContext;
  reason?: string | null;
  tx: Prisma.TransactionClient;
  dryRun?: boolean;
}): Promise<AutoLinkSummary> {
  const { alumniId, studentId, ctx, tx } = args;
  const dryRun = args.dryRun ?? false;
  const reason = args.reason ?? `auto-link to ${studentId}`;
  const perEntity = emptyPerEntity();
  const collected: { resourceType: string; resourceId: string; changes: FieldChange[] }[] = [];
  let linkedCount = 0;
  let homeMigrated = false;
  let homeMigratedFrom: string | null = null;

  const alumni = await tx.alumni.findUnique({
    where: { id: alumniId },
    select: { id: true, homeAddress: true, prefix: true, firstName: true, lastName: true },
  });

  if (alumni) {
    const alumniName = {
      prefix: alumni.prefix ?? null,
      firstName: alumni.firstName,
      lastName: alumni.lastName,
    };
    const pendingWhere = { pendingStudentId: studentId, deletedAt: null };
    const nameSelect = {
      id: true,
      prefix: true,
      firstName: true,
      lastName: true,
      studentId: true,
    } as const;

    // The 5 name-required entities share one uniform flip+rename path.
    const uniform: { kind: LinkEntityKind; find: () => Promise<PendingNameRow[]>; update: (id: string, data: Record<string, unknown>) => Promise<unknown> }[] = [
      { kind: "award", find: () => tx.award.findMany({ where: pendingWhere, select: nameSelect }), update: (id, data) => tx.award.update({ where: { id }, data }) },
      { kind: "association", find: () => tx.association.findMany({ where: pendingWhere, select: nameSelect }), update: (id, data) => tx.association.update({ where: { id }, data }) },
      { kind: "graduate_committee", find: () => tx.graduateCommittee.findMany({ where: pendingWhere, select: nameSelect }), update: (id, data) => tx.graduateCommittee.update({ where: { id }, data }) },
      { kind: "potential", find: () => tx.potential.findMany({ where: pendingWhere, select: nameSelect }), update: (id, data) => tx.potential.update({ where: { id }, data }) },
      { kind: "model_representative", find: () => tx.modelRepresentative.findMany({ where: pendingWhere, select: nameSelect }), update: (id, data) => tx.modelRepresentative.update({ where: { id }, data }) },
    ];
    for (const ent of uniform) {
      const rows = await ent.find();
      for (const row of rows) {
        const { updateData, changes } = reconcilePendingRow(row, alumniName, studentId, ent.kind);
        linkedCount += 1;
        perEntity[ent.kind].flipped += 1;
        if (changes.length) perEntity[ent.kind].renamed += 1;
        if (!dryRun) await ent.update(row.id, updateData);
        if (changes.length) collected.push({ resourceType: ent.kind, resourceId: row.id, changes });
      }
    }

    // alumni_agency: same flip+rename, plus a one-time homeAddress backfill.
    const agencyRows = await tx.alumniAgency.findMany({
      where: pendingWhere,
      select: { ...nameSelect, homeAddress: true, updatedAt: true },
    });
    for (const row of agencyRows) {
      const { updateData, changes } = reconcilePendingRow(row, alumniName, studentId, "alumni_agency");
      linkedCount += 1;
      perEntity.alumni_agency.flipped += 1;
      if (changes.length) perEntity.alumni_agency.renamed += 1;
      if (!dryRun) await tx.alumniAgency.update({ where: { id: row.id }, data: updateData });
      if (changes.length) collected.push({ resourceType: "alumni_agency", resourceId: row.id, changes });
    }
    const migration = pickHomeAddressMigrationCandidate({
      alumniHomeAddress: alumni.homeAddress,
      agencyRows,
    });
    if (migration) {
      homeMigrated = true;
      homeMigratedFrom = migration.id;
      if (!dryRun) {
        await tx.alumni.update({ where: { id: alumni.id }, data: { homeAddress: migration.homeAddress } });
      }
      collected.push({
        resourceType: "alumni",
        resourceId: alumni.id,
        changes: [{ field: "homeAddress", from: alumni.homeAddress, to: migration.homeAddress }],
      });
    }
  }

  // One LINK log + per-row field changes (linked to it) — only when something
  // linked, never in dryRun. Logging is fire-and-forget (logActivity /
  // recordFieldChanges swallow errors) so it never breaks the caller's request.
  if (!dryRun && linkedCount > 0) {
    const logId = await logActivity(
      ctx,
      "LINK",
      "alumni",
      alumniId,
      {
        source: "auto_link_pending",
        studentId,
        linkedCount,
        perEntity,
        homeMigrated,
        homeMigratedFrom,
      },
      reason,
      tx,
    );
    const actor =
      ctx.actorType === "ADMIN"
        ? { actorType: "ADMIN" as const, userId: ctx.userId, actorName: ctx.userEmail }
        : { actorType: "ALUMNI" as const, alumniId: ctx.alumniId, actorName: ctx.alumniName };
    for (const c of collected) {
      await recordFieldChanges({
        resourceType: c.resourceType,
        resourceId: c.resourceId,
        changes: c.changes,
        actor,
        reason,
        activityLogId: logId,
      });
    }
  }

  return { studentId, alumniId, linkedCount, perEntity, homeMigrated, homeMigratedFrom };
}

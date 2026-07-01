import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

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

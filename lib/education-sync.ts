/**
 * Server-only helpers that keep an alumni's denormalized "primary" degree
 * snapshot in step with its primary Education row. Must NOT be imported from a
 * client component (pulls in Prisma / pg).
 *
 * **Primary = highest degree (derived, never manual).** The primary Education
 * row is always the alumni's highest degree (`DEGREE_RANK`: doctoral > master >
 * bachelor > associate > nursing_assistant, tie-broken by most-recent
 * graduation year). It is recomputed automatically on every education mutation
 * (add / edit / delete) via `recomputePrimaryEducation` — there is no way to
 * manually point it at a lower degree (no schema field, no endpoint exposes
 * `primaryEducationId`).
 *
 * `Alumni` carries a denormalized copy of the primary Education's fields
 * (`studentId`/`degreeLevel`/`graduationYear`/`major`/`cohort`). That snapshot is
 * the FK target the 6 related tables (Award, Association, GraduateCommittee,
 * Potential, ModelRepresentative, AlumniAgency) join on via `studentId`, and
 * what the all-alumni table / facets read — so it must always mirror the
 * primary Education. `Alumni.studentId`'s FK is `ON UPDATE CASCADE`, so when a
 * higher degree becomes primary and the snapshot's `studentId` changes, related
 * rows are re-pointed automatically.
 *
 * Pass a transaction client (`tx`) to run inside a `prisma.$transaction` so the
 * education change + snapshot sync are atomic (used by PUT/DELETE
 * /api/educations/[id]).
 */
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { DEGREE_RANK, type DegreeLevelValue } from "@/lib/alumni-verify";

/** A row carrying just enough to rank by degree (used by the helpers below). */
type RankableEducation = {
  id: string;
  degreeLevel: string;
  graduationYear: number | null;
  createdAt: Date;
};

/**
 * Pick the highest-degree education row: `DEGREE_RANK` descending, then most
 * recent `graduationYear`, then earliest `createdAt` (stable for true ties).
 * Pure — no DB access — so it can be unit-tested and shared.
 */
export function pickHighestEducation<T extends RankableEducation>(
  rows: T[],
): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    const byRank =
      (DEGREE_RANK[b.degreeLevel as DegreeLevelValue] ?? 0) -
      (DEGREE_RANK[a.degreeLevel as DegreeLevelValue] ?? 0);
    if (byRank !== 0) return byRank;
    const byYear = (b.graduationYear ?? -1) - (a.graduationYear ?? -1);
    if (byYear !== 0) return byYear;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

/**
 * Re-sync the denormalized `Alumni` snapshot from its primary Education row.
 * No-op if the alumni has no primary Education set. Call after the primary has
 * been (re)assigned by `recomputePrimaryEducation`.
 */
export async function syncPrimarySnapshot(
  alumniId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  const alumni = await tx.alumni.findUnique({
    where: { id: alumniId },
    select: { primaryEducation: true },
  });
  const primary = alumni?.primaryEducation;
  if (!primary) return;

  await tx.alumni.update({
    where: { id: alumniId },
    data: {
      studentId: primary.studentId,
      degreeLevel: primary.degreeLevel,
      graduationYear: primary.graduationYear,
      major: primary.major,
      cohort: primary.cohort,
    },
  });
}

/**
 * Recompute the primary Education as the alumni's **highest** degree and mirror
 * it onto the snapshot. Sets `primaryEducationId` to the highest-degree row (or
 * `null` if none remain) and re-syncs the denormalized snapshot. The primary is
 * fully derived — this is the ONLY writer of `primaryEducationId` in the
 * mutation paths, and it always picks the highest, so the primary can never be
 * a lower degree.
 *
 * `excludeId` skips a row from consideration — used by the DELETE handler to
 * reassign primary away from the doomed row (clearing the FK) before it is
 * deleted, then pick the next-highest.
 *
 * Call this after every education mutation (add / edit / delete), ideally
 * inside the route's `$transaction`.
 */
export async function recomputePrimaryEducation(
  alumniId: string,
  tx: Prisma.TransactionClient = prisma,
  excludeId?: string,
): Promise<void> {
  const rows = await tx.education.findMany({
    where: { alumniId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, degreeLevel: true, graduationYear: true, createdAt: true },
    orderBy: [{ graduationYear: "desc" }, { createdAt: "asc" }],
  });
  const highest = pickHighestEducation(rows);
  const newPrimaryId = highest?.id ?? null;

  const alumni = await tx.alumni.findUnique({
    where: { id: alumniId },
    select: { primaryEducationId: true },
  });
  if (alumni && alumni.primaryEducationId !== newPrimaryId) {
    await tx.alumni.update({
      where: { id: alumniId },
      data: { primaryEducationId: newPrimaryId },
    });
  }
  // Mirror the (possibly changed) primary onto the snapshot. No-op when no
  // primary education remains.
  await syncPrimarySnapshot(alumniId, tx);
}

/**
 * Ensure an alumni has at least one Education row (creating one from the
 * denormalized snapshot if it has none), then let `recomputePrimaryEducation`
 * pick the primary. This is the creation-path entry point — every new alumni
 * gets a primary Education row whose degree mirrors its snapshot. No-op once a
 * valid primary already exists (the real mutations recompute it themselves).
 *
 * Call it from every alumni-creation path (import, `ensureAlumni`,
 * create-with-related, base POST); the one-time catch-up for records created
 * before that wiring is `scripts/backfill-educations.ts`.
 */
export async function ensurePrimaryEducationFromSnapshot(
  alumniId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  const alumni = await tx.alumni.findUnique({
    where: { id: alumniId },
    select: {
      primaryEducationId: true,
      studentId: true,
      degreeLevel: true,
      graduationYear: true,
      major: true,
      cohort: true,
      firstName: true,
      lastName: true,
      educations: { select: { id: true } },
    },
  });
  if (!alumni) return;

  // A valid primary already exists — primary tracks the highest degree and is
  // recomputed on real mutations, so there's nothing to do here.
  if (
    alumni.primaryEducationId &&
    alumni.educations.some((e) => e.id === alumni.primaryEducationId)
  ) {
    return;
  }

  // No degree rows at all — materialize one from the snapshot (the creation
  // case: a brand-new alumni needs its first education row).
  if (alumni.educations.length === 0) {
    await tx.education.create({
      data: {
        alumniId,
        studentId: alumni.studentId,
        degreeLevel: alumni.degreeLevel,
        graduationYear: alumni.graduationYear,
        major: alumni.major,
        cohort: alumni.cohort,
        firstName: alumni.firstName,
        lastName: alumni.lastName,
      },
    });
  }

  // Primary = highest degree (for a single row, that's the one we just made).
  await recomputePrimaryEducation(alumniId, tx);
}

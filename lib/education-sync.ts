/**
 * Server-only helper that keeps an alumni's denormalized "primary" degree
 * snapshot in step with its primary Education row. Must NOT be imported from a
 * client component (pulls in Prisma / pg).
 *
 * `Alumni` carries a denormalized copy of the primary Education's fields
 * (`studentId`/`degreeLevel`/`graduationYear`/`major`/`cohort`). That snapshot is
 * the FK target the 6 related tables (Award, Association, GraduateCommittee,
 * Potential, ModelRepresentative, AlumniAgency) join on via `studentId`, and
 * what the all-alumni table / facets read — so it must always mirror the
 * primary Education. Call this after the primary Education row is created or
 * edited. `Alumni.studentId`'s FK is `ON UPDATE CASCADE`, so changing it here
 * re-points related rows automatically (same as editing studentId on Alumni
 * directly). No-op if the alumni has no primary Education set.
 *
 * Pass a transaction client (`tx`) to run inside a `prisma.$transaction` so the
 * education edit + snapshot sync are atomic (used by PUT /api/educations/[id]).
 */
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

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
 * INVERSE of `syncPrimarySnapshot`: ensure an alumni has a **primary Education
 * row** mirroring its denormalized degree snapshot. If the alumni has no
 * Education rows, create one from the snapshot (`studentId`/`degreeLevel`/
 * `graduationYear`/`major`/`cohort` + the study-time `firstName`/`lastName`)
 * and point `primaryEducationId` at it. If rows exist but none is flagged
 * primary, adopt the first. No-op once a valid primary is set.
 *
 * This is what makes "every active alumni has ≥1 Education row" hold — so the
 * profile education section (`EducationSection`) is never empty for an alumni
 * that plainly has a degree (which the all-alumni table shows from the CMU
 * merge). Call it from EVERY alumni-creation path (import, `ensureAlumni`,
 * create-with-related, base POST); the bulk backfill is
 * `scripts/backfill-educations.ts`.
 *
 * Pass a transaction client (`tx`) to run inside a `prisma.$transaction`.
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
      educations: { select: { id: true }, orderBy: { graduationYear: "desc" } },
    },
  });
  if (!alumni) return;

  // A valid primary already exists — nothing to do.
  if (
    alumni.primaryEducationId &&
    alumni.educations.some((e) => e.id === alumni.primaryEducationId)
  ) {
    return;
  }

  let primaryId = alumni.primaryEducationId;
  if (alumni.educations.length === 0) {
    // No degree rows at all — materialize one from the snapshot.
    const created = await tx.education.create({
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
    primaryId = created.id;
  } else if (!primaryId) {
    // Rows exist but none flagged primary — adopt the highest (most recent grad).
    primaryId = alumni.educations[0].id;
  }

  if (primaryId && primaryId !== alumni.primaryEducationId) {
    await tx.alumni.update({
      where: { id: alumniId },
      data: { primaryEducationId: primaryId },
    });
  }
}

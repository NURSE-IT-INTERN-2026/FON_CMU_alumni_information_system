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

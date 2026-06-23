/**
 * Server-only helper that re-syncs an alumni's CURRENT name from the study-time
 * name of their highest degree. Must NOT be imported from a client component
 * (pulls in Prisma / pg).
 *
 * The personal-info name (`firstName`/`lastName`) defaults to the highest
 * degree's study-time name (precedence: nursing_assistant → associate →
 * bachelor → master → doctoral). It is re-synced whenever the degree set
 * changes — UNLESS the alumni has manually overridden it
 * (`Alumni.nameManuallyUpdated`, set by an `อัพเดท` edit). `prefix` has no
 * per-degree source, so it is not touched here.
 *
 * Mirrors `syncPrimarySnapshot` (`lib/education-sync.ts`). Pass a transaction
 * client to run inside a `$transaction` so the education change + name sync are
 * atomic.
 */
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { DEGREE_RANK } from "@/lib/alumni-verify";

export async function syncNameFromHighestDegree(
  alumniId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  const alumni = await tx.alumni.findUnique({
    where: { id: alumniId },
    select: {
      nameManuallyUpdated: true,
      educations: {
        select: { degreeLevel: true, firstName: true, lastName: true },
      },
    },
  });
  // Manual override locked in → never auto-overwrite the current name.
  if (!alumni || alumni.nameManuallyUpdated) return;

  // Highest degree first (doctoral > master > bachelor > associate > nursing_assistant).
  const ranked = [...alumni.educations].sort(
    (a, b) =>
      (DEGREE_RANK[b.degreeLevel] ?? 0) - (DEGREE_RANK[a.degreeLevel] ?? 0),
  );
  const highest = ranked.find((e) => e.firstName || e.lastName);
  if (!highest) return;

  const data: Record<string, string> = {};
  if (highest.firstName) data.firstName = highest.firstName;
  if (highest.lastName) data.lastName = highest.lastName;
  if (Object.keys(data).length === 0) return;

  await tx.alumni.update({ where: { id: alumniId }, data });
}

import prisma from "@/lib/prisma";
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

  const prev = alumni.homeAddress ?? null;
  if (prev === next) return; // unchanged → no write, no orange highlight

  await prisma.alumni.update({
    where: { id: alumni.id },
    data: { homeAddress: next },
  });

  const changes: FieldChange[] = [{ field: "homeAddress", from: prev, to: next }];
  const logId = await logActivity(
    args.ctx,
    "UPDATE",
    "alumni",
    alumni.id,
    { source: "alumni_agency_sync", changes },
    args.reason ?? null,
  );
  await recordFieldChanges({
    resourceType: "alumni",
    resourceId: alumni.id,
    changes,
    actor:
      args.ctx.actorType === "ADMIN"
        ? { actorType: "ADMIN", userId: args.ctx.userId, actorName: args.ctx.userEmail }
        : { actorType: "ALUMNI", alumniId: args.ctx.alumniId, actorName: args.ctx.alumniName },
    reason: args.reason ?? null,
    activityLogId: logId,
  });
}

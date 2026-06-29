import prisma from "@/lib/prisma";

/**
 * Per-field change tracking — powers the orange "updated value" indicators on
 * the admin data pages and the System Logs old→new details modal (PRD §3.16).
 *
 * `resourceType` values mirror `LogResource` (alumni | award | association | …).
 */

export type FieldChange = {
  field: string;
  from: string | null;
  to: string | null;
};

/** Editable scalar fields tracked per resource (must match the model columns). */
export const TRACKED_FIELDS: Record<string, string[]> = {
  award: ["awardName", "awardType", "year", "description", "major", "prefix", "firstName", "lastName", "link", "imageUrl"],
  association: ["prefix", "firstName", "lastName", "associationName", "position", "recordedYear", "major"],
  graduate_committee: ["prefix", "firstName", "lastName", "termYear", "cohort", "position", "remarks", "major"],
  potential: ["prefix", "firstName", "lastName", "career", "position", "recordedYear", "major"],
  model_representative: ["prefix", "firstName", "lastName", "cohort", "generation", "major"],
  alumni_agency: [
    "studentId",
    "major",
    "cohort",
    "prefix",
    "firstName",
    "lastName",
    "englishName",
    "workplace",
    "homeAddress",
    "country",
    "notes",
  ],
  alumni: [
    "studentId",
    "prefix",
    "firstName",
    "lastName",
    "englishName",
    "cohort",
    "degreeLevel",
    "email",
    "contactEmail",
    "phones",
    "homeAddress",
    "remarks",
  ],
  alumni_profile: [
    "prefix",
    "firstName",
    "lastName",
    "englishName",
    "cohort",
    "degreeLevel",
    "email",
    "contactEmail",
    "phones",
    "homeAddress",
    "remarks",
  ],
  education: [
    "studentId",
    "degreeLevel",
    "graduationYear",
    "major",
    "cohort",
    "firstName",
    "lastName",
  ],
};

function coerce(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return typeof v === "object" ? null : String(v);
}

/** Compare two records over the given fields; return only fields that changed. */
export function computeFieldChanges(
  oldRec: Record<string, unknown> | null,
  newRec: Record<string, unknown>,
  fields: string[]
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    const from = coerce(oldRec?.[field]);
    const to = coerce(newRec[field]);
    if (from !== to) {
      changes.push({ field, from, to });
    }
  }
  return changes;
}

export type ChangeActor =
  | { actorType: "ADMIN"; userId: string; actorName?: string | null }
  | { actorType: "ALUMNI"; alumniId: string; actorName?: string | null };

/**
 * Persist per-field change rows. Fire-and-forget (like logActivity) — must
 * never throw and break the main request.
 */
export async function recordFieldChanges(args: {
  resourceType: string;
  resourceId: string;
  changes: FieldChange[];
  actor: ChangeActor;
  reason?: string | null;
}): Promise<void> {
  if (args.changes.length === 0) return;
  try {
    await prisma.fieldChangeHistory.createMany({
      data: args.changes.map((c) => ({
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        field: c.field,
        oldValue: c.from,
        newValue: c.to,
        actorType: args.actor.actorType,
        userId: args.actor.actorType === "ADMIN" ? args.actor.userId : null,
        alumniId: args.actor.actorType === "ALUMNI" ? args.actor.alumniId : null,
        actorName: args.actor.actorName ?? null,
        reason: args.reason ?? null,
      })),
    });
  } catch (err) {
    console.error("Failed to record field changes:", err);
  }
}

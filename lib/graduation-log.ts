/**
 * Server-only generator for SYSTEM "graduation" activity logs. Must NOT be
 * imported from a client component (pulls in Prisma / pg / CMU fetch).
 *
 * For every degree an alumni earned (each `Education` row), writes one
 * `ActivityLog` (actorType: SYSTEM, resource: "education") ordered by the CMU
 * `grad_date`. The earliest degree (or the first one when none were logged yet)
 * is `CREATE`; the rest are `UPDATE`. Remark: "สำเร็จการศึกษา <degreeLabel>".
 * Each log is backdated to its `grad_date` and links `FieldChangeHistory` rows
 * (the education fields) via `activityLogId`, so the timeline's click-to-open
 * modal shows the new degree's fields.
 *
 * Idempotent: a degree already logged (keyed by `details.studentId`) is skipped.
 */
import prisma from "@/lib/prisma";
import { Prisma, type DegreeLevel } from "@/app/generated/prisma/client";
import { logActivity } from "@/lib/activity-log";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import { DEGREE_LEVEL_OPTIONS } from "@/lib/constants";

const DEGREE_LABELS: Record<string, string> = Object.fromEntries(
  DEGREE_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
);

/** Parse a CMU `grad_date` string into a Date (best-effort). Null if unparseable. */
function parseGradDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.trim().replace(/\//g, "-"));
  return isNaN(d.getTime()) ? null : d;
}

/** Fall back to the Buddhist `graduationYear` → a Jan-1 of that year (for ordering). */
function yearToDate(year: number | null, fallback: Date): Date {
  if (!year || !Number.isFinite(year)) return fallback;
  return new Date(year, 0, 1);
}

interface DegreeEvent {
  studentId: string;
  degreeLevel: DegreeLevel;
  graduationYear: number | null;
  major: string | null;
  cohort: string | null;
  firstName: string | null;
  lastName: string | null;
  at: Date;
}

function educationFieldRows(ev: DegreeEvent, alumniId: string, logId: string) {
  const reason = `สำเร็จการศึกษา ${DEGREE_LABELS[ev.degreeLevel] ?? ev.degreeLevel}`;
  const fields: Array<[string, string | null]> = [
    ["studentId", ev.studentId],
    ["degreeLevel", ev.degreeLevel],
    ["graduationYear", ev.graduationYear != null ? String(ev.graduationYear) : null],
    ["major", ev.major],
    ["cohort", ev.cohort],
    ["firstName", ev.firstName],
    ["lastName", ev.lastName],
  ];
  return fields.map(([field, newValue]) => ({
    resourceType: "education",
    resourceId: alumniId,
    field,
    oldValue: null,
    newValue,
    actorType: "SYSTEM" as const,
    alumniId,
    reason,
    activityLogId: logId,
    createdAt: ev.at,
  }));
}

/**
 * Generate graduation logs for `alumniId`. Safe to re-run — already-logged
 * degrees (by `details.studentId`) are skipped. Pass a transaction client to run
 * inside a `$transaction`.
 */
export async function generateGraduationLogs(
  alumniId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  const alumni = await tx.alumni.findUnique({
    where: { id: alumniId },
    select: { educations: true },
  });
  if (!alumni || alumni.educations.length === 0) return;

  // Which degrees are already logged?
  const existing = await tx.activityLog.findMany({
    where: { alumniId, actorType: "SYSTEM", resource: "education" },
    select: { details: true },
  });
  const loggedStudentIds = new Set(
    existing
      .map((l) => (l.details as { studentId?: string } | null)?.studentId)
      .filter((s): s is string => !!s),
  );
  const alreadyLoggedCount = existing.length;

  // Build degree events with a grad_date timestamp (CMU → graduationYear → row createdAt).
  const events: DegreeEvent[] = [];
  for (const e of alumni.educations) {
    if (loggedStudentIds.has(e.studentId)) continue;
    const cmu = await fetchCmuGraduateById(e.studentId);
    const at =
      parseGradDate(cmu?.grad_date) ??
      yearToDate(e.graduationYear, e.createdAt);
    events.push({
      studentId: e.studentId,
      degreeLevel: e.degreeLevel,
      graduationYear: e.graduationYear,
      major: e.major,
      cohort: e.cohort,
      firstName: e.firstName,
      lastName: e.lastName,
      at,
    });
  }
  if (events.length === 0) return;

  // Earliest first; the first degree ever (no prior logs) is CREATE, rest UPDATE.
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const isFirstEver = alreadyLoggedCount === 0 && i === 0;
    const label = DEGREE_LABELS[ev.degreeLevel] ?? ev.degreeLevel;
    const logId = await logActivity(
      { actorType: "SYSTEM", alumniId },
      isFirstEver ? "CREATE" : "UPDATE",
      "education",
      null,
      {
        studentId: ev.studentId,
        degreeLevel: ev.degreeLevel,
        graduationYear: ev.graduationYear,
        major: ev.major,
        cohort: ev.cohort,
      },
      null,
      `สำเร็จการศึกษา ${label}`,
      tx,
    );
    if (!logId) continue;
    // Backdate the log to the graduation date, and link its field changes.
    await tx.activityLog.update({ where: { id: logId }, data: { createdAt: ev.at } });
    await tx.fieldChangeHistory.createMany({
      data: educationFieldRows(ev, alumniId, logId),
    });
  }
}

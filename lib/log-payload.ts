/**
 * Build the `details` payload for CREATE activity logs so the created record's
 * fields are visible in the timeline + System Logs (PRD §3.16/§3.18). The keys
 * intentionally match `FIELD_LABELS` in `lib/log-detail.ts`, so `detailRows()`
 * renders them as Thai-labeled rows. Plain-object input (no Prisma import) —
 * server-only by virtue of the callers.
 */

/** Snapshot of the created alumni core record for a CREATE-alumni log. */
export function alumniRecordDetails(alumni: {
  prefix?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  englishName?: string | null;
  studentId?: string | null;
  cohort?: string | null;
  degreeLevel?: string | null;
  major?: string | null;
  graduationYear?: number | null;
  email?: string | null;
  contactEmail?: string | null;
  phones?: string[] | null;
  homeAddress?: string | null;
}): Record<string, unknown> {
  return {
    prefix: alumni.prefix ?? null,
    firstName: alumni.firstName ?? null,
    lastName: alumni.lastName ?? null,
    englishName: alumni.englishName ?? null,
    studentId: alumni.studentId ?? null,
    cohort: alumni.cohort ?? null,
    degreeLevel: alumni.degreeLevel ?? null,
    major: alumni.major ?? null,
    graduationYear: alumni.graduationYear ?? null,
    email: alumni.email ?? null,
    contactEmail: alumni.contactEmail ?? null,
    // `phones` is String[] — join so formatValue renders the list, not "—".
    phones: (alumni.phones ?? []).filter(Boolean).join(", ") || null,
    homeAddress: alumni.homeAddress ?? null,
  };
}

/** Snapshot of the created education record for a CREATE-education log. */
export function educationRecordDetails(edu: {
  studentId?: string | null;
  degreeLevel?: string | null;
  graduationYear?: number | null;
  major?: string | null;
  cohort?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Record<string, unknown> {
  return {
    studentId: edu.studentId ?? null,
    degreeLevel: edu.degreeLevel ?? null,
    graduationYear: edu.graduationYear ?? null,
    major: edu.major ?? null,
    cohort: edu.cohort ?? null,
    firstName: edu.firstName ?? null,
    lastName: edu.lastName ?? null,
  };
}

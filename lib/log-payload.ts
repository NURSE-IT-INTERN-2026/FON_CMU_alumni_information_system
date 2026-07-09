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

/**
 * Build a `details` object for a CREATE log by picking the given fields off a
 * created record (keys match `FIELD_LABELS` so `detailRows` renders them).
 * Array values (e.g. phones) are joined into a string. Used by the 6
 * related-entity CREATE routes via `TRACKED_FIELDS[<entity>]`.
 */
export function recordDetailsFromFields(
  record: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = record[f];
    out[f] = Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined && x !== "").join(", ") : (v ?? null);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Self-edit section diff — what an alumni added/removed in each related
// section (awards / associations / …). Stored as `details.sectionChanges` and
// rendered on both the profile timeline and the System Logs page.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export interface SectionDiff {
  added: string[];
  removed: string[];
}

/** Diff two row sets by a natural key → human labels for added/removed rows. */
export function diffSection(
  oldRows: Row[],
  newRows: Row[],
  keyOf: (r: Row) => string,
  labelOf: (r: Row) => string,
): SectionDiff {
  const oldMap = new Map<string, string>();
  for (const o of oldRows) {
    const k = keyOf(o);
    if (k && !oldMap.has(k)) oldMap.set(k, labelOf(o));
  }
  const newMap = new Map<string, string>();
  for (const n of newRows) {
    const k = keyOf(n);
    if (k && !newMap.has(k)) newMap.set(k, labelOf(n));
  }
  const added: string[] = [];
  const removed: string[] = [];
  for (const [k, label] of newMap) if (!oldMap.has(k)) added.push(label);
  for (const [k, label] of oldMap) if (!newMap.has(k)) removed.push(label);
  return { added, removed };
}

/** Natural-key + Thai label per related section (mirrors the alumni full-form
 *  + self-edit field sets). Keys must match across old (DB) and new (payload). */
export const SECTION_DIFF_CONFIG: Record<
  string,
  { keyOf: (r: Row) => string; labelOf: (r: Row) => string }
> = {
  awards: {
    keyOf: (r) => [str(r.awardName), String(r.year ?? "")].join("|"),
    labelOf: (r) => {
      const name = str(r.awardName) ?? "รางวัล";
      const yr = str(String(r.year ?? ""));
      return yr ? `${name} (${yr})` : name;
    },
  },
  associations: {
    keyOf: (r) => [str(r.associationName), str(r.position), String(r.recordedYear ?? "")].join("|"),
    labelOf: (r) => {
      const name = str(r.associationName) ?? "สมาคม/ชมรม";
      const pos = str(r.position);
      const yr = str(String(r.recordedYear ?? ""));
      return [name, pos, yr ? `(${yr})` : null].filter(Boolean).join(" — ");
    },
  },
  graduateCommittees: {
    keyOf: (r) => [String(r.termYear ?? ""), str(r.position)].join("|"),
    labelOf: (r) => {
      const pos = str(r.position);
      const term = str(String(r.termYear ?? ""));
      return [pos, term ? `ปี ${term}` : null].filter(Boolean).join(" ") || "กรรมการบัณฑิต";
    },
  },
  potentials: {
    keyOf: (r) => [str(r.career), str(r.position), String(r.recordedYear ?? "")].join("|"),
    labelOf: (r) => {
      const parts = [str(r.career), str(r.position)].filter(Boolean);
      const yr = str(String(r.recordedYear ?? ""));
      const label = parts.join(" — ") || "ศักยภาพ";
      return yr ? `${label} (${yr})` : label;
    },
  },
  modelRepresentatives: {
    keyOf: (r) => [str(r.cohort), String(r.generation ?? "")].join("|"),
    labelOf: (r) => {
      const gen = str(String(r.generation ?? ""));
      const cohort = str(r.cohort);
      return gen ? `ผู้แทนรุ่น ${gen}` : cohort ? `ผู้แทนรุ่น ${cohort}` : "ผู้แทนรุ่น";
    },
  },
  alumniAgency: {
    keyOf: (r) => [str(r.workplace), str(r.country)].join("|"),
    labelOf: (r) => {
      const parts = [str(r.workplace), str(r.country)].filter(Boolean);
      return parts.join(" — ") || "ข้อมูลการทำงานศิษย์เก่า";
    },
  },
};

/**
 * Build `details.sectionChanges` from old (pre-edit) and new (submitted)
 * related rows. Only sections that actually changed are included.
 */
export function buildSectionChanges(
  oldBySection: Record<string, Row[]>,
  newBySection: Record<string, Row[]>,
): Record<string, SectionDiff> | null {
  const out: Record<string, SectionDiff> = {};
  for (const [section, cfg] of Object.entries(SECTION_DIFF_CONFIG)) {
    const oldRows = oldBySection[section] ?? [];
    const newRows = newBySection[section] ?? [];
    const diff = diffSection(oldRows, newRows, cfg.keyOf, cfg.labelOf);
    if (diff.added.length > 0 || diff.removed.length > 0) out[section] = diff;
  }
  return Object.keys(out).length > 0 ? out : null;
}

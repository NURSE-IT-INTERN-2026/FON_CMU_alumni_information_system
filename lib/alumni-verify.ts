/**
 * Pure helpers for verifying an alumni signup against either the local DB or
 * the CMU Registrar API. No Prisma, no network — safe to unit-test.
 *
 * Identity fields (5): studentId, cohort (= graduation year), firstName,
 * lastName, birthDate (form collects Buddhist-era DDMMYYYY).
 *
 * CMU mapping: student_id, grad_year, name_th, surname_th, birthday (DD-MM-YYYY
 * Gregorian).
 */

import type { CmuGraduate } from "./cmu-registrar";

export type DegreeLevelValue =
  | "DOCTORAL"
  | "MASTER"
  | "BACHELOR"
  | "NURSING_ASSISTANT"
  | "ASSOCIATE";

// ---------------------------------------------------------------------------
// Name helpers
// ---------------------------------------------------------------------------

/** Trim, collapse internal whitespace, lowercase (no-op for Thai; helps EN). */
export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Cohort derivation (Bachelor) → "DN{YY}"
// ---------------------------------------------------------------------------

/**
 * Derive a Bachelor cohort label from a Buddhist graduation year: "DN{YY}",
 * where YY = the last two digits of (gradYear - 3). E.g. grad_year 2525 →
 * "DN22" (2525 − 3 = 2522 → "22"). Used to auto-fill the cohort column for
 * Bachelor graduates — CMU returns `grad_year` but no cohort. Returns null for
 * a missing/non-numeric year. Caller gates on degree == BACHELOR.
 */
export function bachelorCohortFromGradYear(
  gradYear: string | number | null | undefined,
): string | null {
  const n =
    typeof gradYear === "number" ? gradYear : parseInt(String(gradYear ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `DN${(n - 3) % 100}`;
}

// ---------------------------------------------------------------------------
// Birth date normalization → canonical Gregorian "YYYY-MM-DD"
// ---------------------------------------------------------------------------

/**
 * Parse the signup form's birthDate (Buddhist-era DDMMYYYY, e.g. "01122540")
 * into canonical Gregorian "YYYY-MM-DD". Buddhist years (>= 2400) get - 543.
 * Returns null if unparseable.
 */
export function normalizeFormBirthDate(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = parseInt(digits.slice(4, 8), 10);
  if (Number.isNaN(yyyy)) return null;
  const ce = yyyy >= 2400 ? yyyy - 543 : yyyy;
  return `${ce}-${mm}-${dd}`;
}

/**
 * Parse the CMU Registrar "birthday" field (DD-MM-YYYY Gregorian, e.g.
 * "01-12-1997" → 1 Dec 1997) into the same canonical "YYYY-MM-DD". Defensive:
 * accepts - / . / separators and digit-only DDMMYYYY. Returns null if unparseable.
 */
export function normalizeCmuBirthday(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  const parts = s.split(/[-/.]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const y = parseInt(yyyy, 10);
    if (Number.isNaN(y)) return null;
    return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length === 8) {
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const y = parseInt(digits.slice(4, 8), 10);
    if (Number.isNaN(y)) return null;
    return `${y}-${mm}-${dd}`;
  }

  return null;
}

/**
 * Format a canonical Gregorian "YYYY-MM-DD" birthday as Thai "DD-MM-YYYY"
 * (Buddhist era; year + 543), e.g. "1997-12-01" → "01-12-2540". Returns null
 * if the input is missing or doesn't start with a YYYY-MM-DD date.
 */
export function formatBirthDateThai(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(input).trim());
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const be = parseInt(yyyy, 10) + 543;
  return `${dd}-${mm}-${be}`;
}

/**
 * Same as {@link formatBirthDateThai} but with "/" separators —
 * "DD/MM/YYYY" (Buddhist era), e.g. "1997-12-01" → "01/12/2540". Used by the
 * profile pages' "วันเกิด (วว/ดด/ปปปป)" field.
 */
export function formatBirthDateThaiSlash(
  input: string | null | undefined,
): string | null {
  const dashed = formatBirthDateThai(input);
  return dashed ? dashed.replaceAll("-", "/") : null;
}

/** True when the form birthDate and CMU birthday refer to the same Gregorian day. */
export function birthDatesMatch(
  formInput: string | null | undefined,
  cmuBirthday: string | null | undefined,
): boolean {
  const a = normalizeFormBirthDate(formInput);
  const b = normalizeCmuBirthday(cmuBirthday);
  if (!a || !b) return false;
  return a === b;
}

// ---------------------------------------------------------------------------
// Cohort / graduation year helpers
// ---------------------------------------------------------------------------

/** Digits-only representation, to compare years regardless of formatting. */
export function normalizeYear(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** A 4-digit year like "2569" (Buddhist) or "1997" (Gregorian). */
export function isYearLike(value: string | null | undefined): boolean {
  return /^\d{4}$/.test((value ?? "").trim());
}

// ---------------------------------------------------------------------------
// CMU degree level mapping (mirrors app/api/cmu-alumni/route.ts logic)
// ---------------------------------------------------------------------------

const NURSING_ASSISTANT_MAJOR = "ประกาศนียบัตรผู้ช่วยพยาบาล";

/** Map a CMU level_id (+ major_name_th) to our DegreeLevel enum value. */
export function cmuLevelToDegree(
  levelId: string | null | undefined,
  // Optional: only consulted when levelId === "0" (to disambiguate
  // NURSING_ASSISTANT vs ASSOCIATE); irrelevant for all other levels.
  majorNameTh?: string | null | undefined,
): DegreeLevelValue {
  switch (String(levelId ?? "")) {
    case "5":
      return "DOCTORAL";
    case "3":
      return "MASTER";
    case "2":
      return "NURSING_ASSISTANT";
    case "1":
      return "BACHELOR";
    case "0":
      return (majorNameTh ?? "").trim() === NURSING_ASSISTANT_MAJOR
        ? "NURSING_ASSISTANT"
        : "ASSOCIATE";
    default:
      return "BACHELOR";
  }
}

// ---------------------------------------------------------------------------
// CMU graduate matching
// ---------------------------------------------------------------------------

export interface SignupIdentityInput {
  studentId: string;
  cohort: string;
  firstName: string;
  lastName: string;
  birthDate: string;
}

/**
 * Whether a CMU graduate record matches all 5 signup identity fields. CMU has
 * no separate "cohort" field — grad_year is the graduation year.
 */
export function matchCmuGraduate(
  grad: CmuGraduate,
  input: SignupIdentityInput,
): boolean {
  // studentId + names are the core identity (always present for a valid record)
  if (String(grad.student_id ?? "").trim() !== input.studentId.trim()) return false;
  if (normalizeName(grad.name_th) !== normalizeName(input.firstName)) return false;
  if (normalizeName(grad.surname_th) !== normalizeName(input.lastName))
    return false;

  // CMU data is sparse — grad_year & birthday are frequently null. Enforce them
  // only when the CMU record actually provides them.
  const gradYear = normalizeYear(grad.grad_year);
  if (gradYear && gradYear !== normalizeYear(input.cohort)) return false;

  if (grad.birthday && !birthDatesMatch(input.birthDate, grad.birthday)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Display-only dedup: collapse a person's multiple degree records
// ---------------------------------------------------------------------------

/**
 * Highest → lowest degree ranking. The CMU Registrar returns one record per
 * degree a person earned at FON, so the same person can appear several times.
 * When deduping for display we keep the record of their HIGHEST degree. Order
 * matches `DEGREE_ORDER` in `app/api/alumni-count/route.ts` and the CLAUDE.md
 * degree-level list.
 */
export const DEGREE_RANK: Record<DegreeLevelValue, number> = {
  NURSING_ASSISTANT: 1,
  ASSOCIATE: 2,
  BACHELOR: 3,
  MASTER: 4,
  DOCTORAL: 5,
};

/**
 * Deduplicate CMU graduate records for DISPLAY: when the same person appears
 * under multiple degree levels (same first name, last name, and birthday), keep
 * only the record for their HIGHEST degree level.
 *
 * **DISPLAY/COUNT-ONLY.** Never feed the result to studentId-keyed lookups
 * (`lib/ensure-alumni.ts`, `app/api/alumni/[id]/route.ts`): a person's
 * lower-degree records carry distinct `student_id`s, and dedup drops them,
 * which would silently break CMU enrichment on import and on the alumni
 * profile view. Apply it only in display/count surfaces (currently
 * `/api/cmu-alumni`, `lib/filter-facets-server.ts`, `/api/alumni-count`,
 * `/api/dashboard`). The raw local list (`getCmuGraduatesLocal`) stays
 * un-deduped so those studentId-keyed consumers keep working.
 *
 * Match key: normalized `name_th` + `surname_th` + canonical birthday. A record
 * missing its birthday or either name is never collapsed (kept verbatim in a
 * separate bucket) — the trio is the identity, and a partial key would wrongly
 * merge strangers. Ties on degree rank keep the first-encountered record
 * (stable; `Map` preserves insertion order). The returned order is not
 * meaningful — every caller sorts or aggregates afterward.
 */
export function dedupeCmuGraduatesByPerson(
  graduates: CmuGraduate[],
): CmuGraduate[] {
  // Keep the highest-degree record per person (normalized first+last name +
  // birthday). Also collect ALL of the person's student_ids and attach them to
  // the kept record as `student_ids`, so consumers bridging on student_id (e.g.
  // the all-alumni table linking a local alumni to its CMU person) can match on
  // any of the person's degrees — not just the kept (highest) one. Without this,
  // a multi-degree person whose kept record kept a different student_id than the
  // degree a local alumni holds can't be linked → duplicate row.
  const bestByKey = new Map<string, CmuGraduate>();
  const sidsByKey = new Map<string, Set<string>>();
  const unkeyed: CmuGraduate[] = []; // incomplete identity — kept verbatim

  for (const g of graduates) {
    const firstName = normalizeName(g.name_th);
    const lastName = normalizeName(g.surname_th);
    const birthday = normalizeCmuBirthday(g.birthday);
    const sid = String(g.student_id ?? "").trim();
    if (!firstName || !lastName || !birthday) {
      unkeyed.push(sid ? { ...g, student_ids: [sid] } : g);
      continue;
    }
    const key = `${firstName}\u0000${lastName}\u0000${birthday}`;
    if (sid) {
      let sids = sidsByKey.get(key);
      if (!sids) { sids = new Set(); sidsByKey.set(key, sids); }
      sids.add(sid);
    }
    const prev = bestByKey.get(key);
    if (!prev) {
      bestByKey.set(key, g);
      continue;
    }
    const prevRank =
      DEGREE_RANK[cmuLevelToDegree(prev.level_id, prev.major_name_th)] ?? 0;
    const curRank =
      DEGREE_RANK[cmuLevelToDegree(g.level_id, g.major_name_th)] ?? 0;
    if (curRank > prevRank) bestByKey.set(key, g);
  }

  const keyed: CmuGraduate[] = [];
  for (const [key, g] of bestByKey) {
    keyed.push({ ...g, student_ids: [...(sidsByKey.get(key) ?? [])] });
  }
  return [...keyed, ...unkeyed];
}

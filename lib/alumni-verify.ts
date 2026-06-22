/**
 * Pure helpers for verifying an alumni signup against either the local DB or
 * the CMU Registrar API. No Prisma, no network — safe to unit-test.
 *
 * Identity fields (5): studentId, cohort (= graduation year), firstName,
 * maidenLastName, birthDate (form collects Buddhist-era DDMMYYYY).
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
  majorNameTh: string | null | undefined,
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
  maidenLastName: string;
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
  if (normalizeName(grad.surname_th) !== normalizeName(input.maidenLastName))
    return false;

  // CMU data is sparse — grad_year & birthday are frequently null. Enforce them
  // only when the CMU record actually provides them.
  const gradYear = normalizeYear(grad.grad_year);
  if (gradYear && gradYear !== normalizeYear(input.cohort)) return false;

  if (grad.birthday && !birthDatesMatch(input.birthDate, grad.birthday)) return false;

  return true;
}

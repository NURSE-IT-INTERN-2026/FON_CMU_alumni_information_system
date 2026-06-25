/**
 * Pure helper that builds the per-field CMU Registrar comparison snapshot for an
 * alumni signup, stored on `Alumni.signupVerification` and rendered in the
 * admin's approve/review modal. No Prisma, no network — safe to unit-test.
 *
 * The admin is the gatekeeper of the signup flow: a signup is always accepted
 * as PENDING (see `app/api/alumni-auth/signup/route.ts`), and this snapshot is
 * what lets the admin see — field by field — whether what the alumni entered
 * matches the authoritative CMU Registrar record (✓ / ✗ / — when CMU couldn't
 * supply that field or was unreachable).
 *
 * Identity fields (6): studentId, firstName, lastName, birthDate, cohort
 * (= graduation year), degreeLevel. Reuses the comparison primitives in
 * `lib/alumni-verify.ts` so the verdicts are consistent with the (now-removed)
 * hard signup gate.
 */
import type { CmuGraduate } from "./cmu-registrar";
import {
  normalizeName,
  normalizeYear,
  normalizeFormBirthDate,
  normalizeCmuBirthday,
  birthDatesMatch,
  cmuLevelToDegree,
  type DegreeLevelValue,
} from "./alumni-verify";

export interface SubmittedSignupFields {
  studentId: string;
  firstName: string;
  lastName: string;
  /** Buddhist-era DDMMYYYY exactly as the form collects it. */
  birthDate: string;
  /** Graduation year string (Buddhist), as entered. */
  cohort: string;
  /** The applicant's chosen DegreeLevel value. */
  degreeLevel: DegreeLevelValue;
}

export interface FieldVerdict {
  /** What the applicant entered (canonicalized where useful, e.g. birthDate). */
  submitted: string | null;
  /** What CMU has on file (canonicalized). Null when CMU has no record/value. */
  authoritative: string | null;
  /**
   * ✓ true / ✗ false, or null when the field could NOT be checked — either CMU
   * was unreachable, the studentId resolved to no record, or CMU's record omits
   * the field (e.g. birthday/grad_year are frequently null).
   */
  match: boolean | null;
}

export interface SignupVerification {
  /** Did CMU respond at all (even "not found")? False = registrar unreachable. */
  cmuConsulted: boolean;
  /** Did the studentId resolve to a CMU record? */
  cmuFound: boolean;
  /** ISO timestamp of when the comparison was computed. */
  comparedAt: string;
  /**
   * The raw submitted form values, stored verbatim so the snapshot can be
   * faithfully rebuilt by "re-verify" (the `fields.*.submitted` values are
   * canonicalized for display, e.g. birthDate → YYYY-MM-DD, and can't round-trip).
   */
  submitted: SubmittedSignupFields;
  /** The CMU record's identity fields, canonicalized (null if none). */
  cmuSnapshot: {
    studentId: string;
    firstName: string;
    lastName: string;
    /** Canonical Gregorian "YYYY-MM-DD", or null. */
    birthDate: string | null;
    degreeLevel: DegreeLevelValue;
    /** CMU `grad_year` (Buddhist, as stored), or null. */
    cohort: string | null;
    major: string | null;
  } | null;
  fields: {
    studentId: FieldVerdict;
    firstName: FieldVerdict;
    lastName: FieldVerdict;
    birthDate: FieldVerdict;
    cohort: FieldVerdict;
    degreeLevel: FieldVerdict;
  };
  /**
   * True iff every field CMU could verify matched. False if any checkable field
   * differs. Null if nothing could be checked (CMU down / not found / all sparse).
   */
  allMatchableMatch: boolean | null;
}

const IDENTITY_FIELDS = [
  "studentId",
  "firstName",
  "lastName",
  "birthDate",
  "cohort",
  "degreeLevel",
] as const;

/**
 * Build the verification snapshot. `cmuConsulted` must be passed by the caller
 * (it knows whether CMU threw vs returned null) — `cmuGrad` may be null.
 */
export function buildSignupVerification(
  submitted: SubmittedSignupFields,
  cmuGrad: CmuGraduate | null,
  cmuConsulted: boolean,
): SignupVerification {
  const comparedAt = new Date().toISOString();

  // CMU unreachable, or no record found → nothing to compare against.
  if (!cmuConsulted || !cmuGrad) {
    const empty = (submittedValue: string | null): FieldVerdict => ({
      submitted: submittedValue,
      authoritative: null,
      match: null,
    });
    return {
      cmuConsulted,
      cmuFound: false,
      comparedAt,
      submitted: { ...submitted },
      cmuSnapshot: null,
      fields: {
        studentId: empty(submitted.studentId.trim() || null),
        firstName: empty(submitted.firstName.trim() || null),
        lastName: empty(submitted.lastName.trim() || null),
        birthDate: empty(normalizeFormBirthDate(submitted.birthDate)),
        cohort: empty(submitted.cohort.trim() || null),
        degreeLevel: empty(submitted.degreeLevel || null),
      },
      allMatchableMatch: null,
    };
  }

  const cmuStudentId = String(cmuGrad.student_id ?? "").trim();
  const cmuFirstName = String(cmuGrad.name_th ?? "").trim();
  const cmuLastName = String(cmuGrad.surname_th ?? "").trim();
  const cmuBirthCanonical = normalizeCmuBirthday(cmuGrad.birthday);
  const cmuCohort = normalizeYear(cmuGrad.grad_year)
    ? String(cmuGrad.grad_year ?? "").trim()
    : null;
  const cmuDegree = cmuLevelToDegree(cmuGrad.level_id, cmuGrad.major_name_th);
  const cmuMajor = cmuGrad.major_name_th?.trim() || null;

  // studentId / names / degreeLevel are always present on a real CMU record.
  const studentIdMatch = cmuStudentId === submitted.studentId.trim();
  const firstNameMatch =
    normalizeName(cmuFirstName) === normalizeName(submitted.firstName);
  const lastNameMatch =
    normalizeName(cmuLastName) === normalizeName(submitted.lastName);
  const degreeMatch = cmuDegree === submitted.degreeLevel;

  // birthDate / cohort are conditional: only verdict-able when CMU supplies them.
  const birthMatch = cmuGrad.birthday
    ? birthDatesMatch(submitted.birthDate, cmuGrad.birthday)
    : null;
  const cohortMatch = cmuCohort
    ? normalizeYear(cmuCohort) === normalizeYear(submitted.cohort)
    : null;

  const fields: SignupVerification["fields"] = {
    studentId: { submitted: submitted.studentId.trim() || null, authoritative: cmuStudentId || null, match: studentIdMatch },
    firstName: { submitted: submitted.firstName.trim() || null, authoritative: cmuFirstName || null, match: firstNameMatch },
    lastName: { submitted: submitted.lastName.trim() || null, authoritative: cmuLastName || null, match: lastNameMatch },
    birthDate: { submitted: normalizeFormBirthDate(submitted.birthDate), authoritative: cmuBirthCanonical, match: birthMatch },
    cohort: { submitted: submitted.cohort.trim() || null, authoritative: cmuCohort, match: cohortMatch },
    degreeLevel: { submitted: submitted.degreeLevel || null, authoritative: cmuDegree, match: degreeMatch },
  };

  const checkable = IDENTITY_FIELDS.map((f) => fields[f].match).filter(
    (m): m is boolean => m !== null,
  );
  const allMatchableMatch =
    checkable.length === 0 ? null : checkable.every(Boolean);

  return {
    cmuConsulted: true,
    cmuFound: true,
    comparedAt,
    submitted: { ...submitted },
    cmuSnapshot: {
      studentId: cmuStudentId,
      firstName: cmuFirstName,
      lastName: cmuLastName,
      birthDate: cmuBirthCanonical,
      degreeLevel: cmuDegree,
      cohort: cmuCohort,
      major: cmuMajor,
    },
    fields,
    allMatchableMatch,
  };
}

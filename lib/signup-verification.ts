/**
 * Pure helper that builds the per-field comparison snapshot for an alumni signup,
 * stored on `Alumni.signupVerification` and rendered in the admin's approve/review
 * modal. No Prisma, no network — safe to unit-test.
 *
 * The admin is the gatekeeper of the signup flow: a signup is always accepted
 * as PENDING (see `app/api/alumni-auth/signup/route.ts`), and this snapshot is
 * what lets the admin see — field by field — whether what the alumni entered
 * matches the authoritative record (✓ / ✗ / — when that field couldn't be
 * checked).
 *
 * Two authoritative sources, in priority order:
 *  1. **CMU Registrar** (`cmuGrad`) — the FON graduate universe, materialized in
 *     `cmu_graduates`. Preferred when the studentId resolves to a CMU record.
 *  2. **Local alumni record** (`local`) — used ONLY when CMU has no record but the
 *     studentId already exists in the local `alumni` table (an admin-created or
 *     legacy-imported alumni, e.g. `studentId=66123456`). Without this fallback,
 *     every local-only signup showed "ไม่พบรหัสนักศึกษา" with no comparison — the
 *     admin couldn't see differences for local alumni at all.
 *
 * `source` records which source was used ("cmu" | "local" | null), so the UI can
 * label the comparison. Identity primitives come from `lib/alumni-verify.ts` so
 * the verdicts are consistent with the (now-removed) hard signup gate.
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

/**
 * The local `alumni` record's identity fields, used as the authoritative source
 * when CMU has no record for the studentId. `birthDate` is DDMMYYYY (Buddhist) —
 * the SAME form format as `SubmittedSignupFields.birthDate` — and
 * `graduationYear` is the numeric Buddhist graduation year, so both compare
 * directly after canonicalization.
 */
export interface LocalAuthoritative {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  /** Buddhist-era DDMMYYYY, or null when the local record omits it. */
  birthDate: string | null;
  /** Numeric Buddhist graduation year (`Alumni.graduationYear`), or null. */
  graduationYear: number | null;
  degreeLevel: DegreeLevelValue | null;
}

export interface FieldVerdict {
  /** What the applicant entered (canonicalized where useful, e.g. birthDate). */
  submitted: string | null;
  /** What the authoritative record has on file (canonicalized). Null when none. */
  authoritative: string | null;
  /**
   * ✓ true / ✗ false, or null when the field could NOT be checked — either no
   * authoritative source was available, the record omits the field, or (CMU)
   * the registrar was unreachable.
   */
  match: boolean | null;
}

export interface SignupVerification {
  /**
   * Which authoritative source the comparison used: "cmu" (CMU Registrar record),
   * "local" (existing local `alumni` record), or null (no record found anywhere /
   * registrar unreachable). Drives the comparison table + source label in the UI.
   */
  source: "cmu" | "local" | null;
  /**
   * Did CMU respond at all (even "not found")? False = registrar unreachable.
   * (Post-local-materialization the local table read rarely throws, so this is
   * almost always true; kept for the genuine "couldn't check" amber case.)
   */
  cmuConsulted: boolean;
  /** True iff the authoritative source was CMU (kept for back-compat). */
  cmuFound: boolean;
  /** ISO timestamp of when the comparison was computed. */
  comparedAt: string;
  /**
   * The raw submitted form values, stored verbatim so the snapshot can be
   * faithfully rebuilt by "re-verify" (the `fields.*.submitted` values are
   * canonicalized for display and can't round-trip).
   */
  submitted: SubmittedSignupFields;
  /** The CMU record's identity fields, canonicalized (null unless source="cmu"). */
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
   * True iff every field the source could verify matched. False if any checkable
   * field differs. Null if nothing could be checked (no source / all sparse).
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
 * Adapt a Prisma `Alumni` row (structurally — no Prisma import) into the
 * `LocalAuthoritative` shape the comparison expects. Pure + client-safe.
 */
export function localAuthoritativeFromAlumni(a: {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  graduationYear: number | null;
  degreeLevel: string | null;
}): LocalAuthoritative {
  return {
    studentId: a.studentId,
    firstName: a.firstName,
    lastName: a.lastName,
    birthDate: a.birthDate,
    graduationYear: a.graduationYear,
    degreeLevel: a.degreeLevel as DegreeLevelValue | null,
  };
}

function emptyFields(submitted: SubmittedSignupFields): SignupVerification["fields"] {
  const empty = (submittedValue: string | null): FieldVerdict => ({
    submitted: submittedValue,
    authoritative: null,
    match: null,
  });
  return {
    studentId: empty(submitted.studentId.trim() || null),
    firstName: empty(submitted.firstName.trim() || null),
    lastName: empty(submitted.lastName.trim() || null),
    birthDate: empty(normalizeFormBirthDate(submitted.birthDate)),
    cohort: empty(submitted.cohort.trim() || null),
    degreeLevel: empty(submitted.degreeLevel || null),
  };
}

/**
 * Build the verification snapshot. `cmuConsulted` must be passed by the caller
 * (it knows whether the CMU read threw vs returned null). `cmuGrad` is the CMU
 * record (preferred source). `local` is the existing local alumni identity —
 * used as the authoritative source ONLY when CMU has no record; pass null/omit
 * when the studentId isn't a pre-existing local alumni.
 */
export function buildSignupVerification(
  submitted: SubmittedSignupFields,
  cmuGrad: CmuGraduate | null,
  cmuConsulted: boolean,
  local?: LocalAuthoritative | null,
): SignupVerification {
  const comparedAt = new Date().toISOString();

  // 1. CMU record found → registrar is authoritative for identity.
  if (cmuConsulted && cmuGrad) {
    return buildCmuVerification(submitted, cmuGrad, comparedAt);
  }

  // 2. CMU has no record, but the studentId is a pre-existing local alumni →
  //    compare against the local record's identity instead.
  if (local && String(local.studentId ?? "").trim()) {
    return buildLocalVerification(submitted, local, cmuConsulted, comparedAt);
  }

  // 3. No authoritative record anywhere (unknown studentId + CMU unreachable).
  return {
    source: null,
    cmuConsulted,
    cmuFound: false,
    comparedAt,
    submitted: { ...submitted },
    cmuSnapshot: null,
    fields: emptyFields(submitted),
    allMatchableMatch: null,
  };
}

/** Compare submitted fields against a CMU Registrar record. */
function buildCmuVerification(
  submitted: SubmittedSignupFields,
  cmuGrad: CmuGraduate,
  comparedAt: string,
): SignupVerification {
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
    source: "cmu",
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

/**
 * Compare submitted fields against a pre-existing LOCAL alumni record's identity
 * (the fallback when CMU has no record). All six identity fields are typically
 * present on a local record, so all six are usually checkable here (unlike CMU,
 * where birthDate/cohort are frequently null).
 */
function buildLocalVerification(
  submitted: SubmittedSignupFields,
  local: LocalAuthoritative,
  cmuConsulted: boolean,
  comparedAt: string,
): SignupVerification {
  const locStudentId = String(local.studentId ?? "").trim();
  const locFirstName = String(local.firstName ?? "").trim();
  const locLastName = String(local.lastName ?? "").trim();

  const subBirth = normalizeFormBirthDate(submitted.birthDate);
  const locBirth = local.birthDate ? normalizeFormBirthDate(local.birthDate) : null;
  // Both sides are Buddhist DDMMYYYY → canonical Gregorian; compare directly.
  const birthMatch = locBirth ? (subBirth != null && subBirth === locBirth) : null;

  // The applicant submits a graduation year, so compare against the local
  // record's `graduationYear` (numeric) — NOT `Alumni.cohort`, which is the
  // "รุ่นที่" cohort label and would always mismatch a year.
  const locGradYear =
    local.graduationYear != null ? String(local.graduationYear).trim() : null;
  const locYear = locGradYear && normalizeYear(locGradYear) ? locGradYear : null;
  const cohortMatch = locYear
    ? normalizeYear(locYear) === normalizeYear(submitted.cohort)
    : null;

  const studentIdMatch = locStudentId === submitted.studentId.trim();
  const firstNameMatch = local.firstName != null
    ? normalizeName(locFirstName) === normalizeName(submitted.firstName)
    : null;
  const lastNameMatch = local.lastName != null
    ? normalizeName(locLastName) === normalizeName(submitted.lastName)
    : null;
  const degreeMatch = local.degreeLevel != null
    ? local.degreeLevel === submitted.degreeLevel
    : null;

  const fields: SignupVerification["fields"] = {
    studentId: { submitted: submitted.studentId.trim() || null, authoritative: locStudentId || null, match: studentIdMatch },
    firstName: { submitted: submitted.firstName.trim() || null, authoritative: locFirstName || null, match: firstNameMatch },
    lastName: { submitted: submitted.lastName.trim() || null, authoritative: locLastName || null, match: lastNameMatch },
    birthDate: { submitted: subBirth, authoritative: locBirth, match: birthMatch },
    cohort: { submitted: submitted.cohort.trim() || null, authoritative: locYear, match: cohortMatch },
    degreeLevel: { submitted: submitted.degreeLevel || null, authoritative: local.degreeLevel, match: degreeMatch },
  };

  const checkable = IDENTITY_FIELDS.map((f) => fields[f].match).filter(
    (m): m is boolean => m !== null,
  );
  const allMatchableMatch =
    checkable.length === 0 ? null : checkable.every(Boolean);

  return {
    source: "local",
    cmuConsulted,
    cmuFound: false,
    comparedAt,
    submitted: { ...submitted },
    cmuSnapshot: null,
    fields,
    allMatchableMatch,
  };
}

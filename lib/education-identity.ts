/**
 * Server-only identity guard for education records. Must NOT be imported from a
 * client component (pulls in the CMU fetch).
 *
 * An alumni's education records are their OWN FON degrees (PRD §3.1.2 — an
 * alumni "claims" a record by verifying identity at sign-up). The add-/edit-
 * education flows therefore must NOT let someone attach a degree whose
 * `studentId` belongs to a DIFFERENT person. Without this guard, a stray degree
 * from a stranger:
 *   - stays as a separate row in the all-alumni table (the table dedups CMU
 *     records by name+birthday, so two different people never collapse), and
 *   - corrupts the dashboard count: `groupPersonsByDegree`
 *     (`lib/person-degree-count.ts`) trusts that all of an alumni's education
 *     studentIds are ONE person, so it bridges + merges the stranger's CMU
 *     record into the alumni — silently moving the alumni out of their real
 *     degree bucket and shrinking the total person count.
 *
 * Same-person is decided by canonical BIRTHDAY — the one identity signal that is
 * constant across a person's degrees (a name can change between degrees, e.g. on
 * marriage, so name is NOT used as the decisive signal). If either side lacks a
 * birthday we can't disprove same-person, so we allow (manual / CMU-sparse
 * degrees). `fetchCmuGraduateById` reads the cached CMU list, so lookups are
 * cheap; if CMU is unreachable the check fails open (returns null = allow) so a
 * registrar outage doesn't block all education edits.
 */
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import { normalizeCmuBirthday, normalizeFormBirthDate } from "@/lib/alumni-verify";

export interface EducationIdentityCheck {
  /** `Alumni.birthDate` as stored (Buddhist-era DDMMYYYY, the signup form format). */
  alumniBirthDate: string | null;
  /**
   * studentIds of the alumni's OTHER educations — used only to derive a
   * reference birthday when `alumniBirthDate` is missing/unparseable. Prefer the
   * primary education's studentId so a pre-existing stray can't become the
   * reference.
   */
  existingStudentIds: string[];
  /** studentId being added/edited. */
  newStudentId: string;
}

/** Resolve the reference (alumni) canonical birthday, Gregorian "YYYY-MM-DD". */
async function resolveReferenceBirthday(
  check: EducationIdentityCheck,
): Promise<string | null> {
  const fromProfile = normalizeFormBirthDate(check.alumniBirthDate);
  if (fromProfile) return fromProfile;
  for (const sid of check.existingStudentIds) {
    if (!sid || sid === check.newStudentId) continue;
    const cmu = await fetchCmuGraduateById(sid).catch(() => null);
    const b = cmu ? normalizeCmuBirthday(cmu.birthday) : null;
    if (b) return b;
  }
  return null;
}

/**
 * Returns a Thai error message if `newStudentId` belongs to a different person
 * than the alumni (birthday mismatch), or `null` if it is OK to save (same
 * person, not in CMU, no birthday to compare, or CMU unreachable).
 */
export async function assertEducationSamePerson(
  check: EducationIdentityCheck,
): Promise<string | null> {
  const newCmu = await fetchCmuGraduateById(check.newStudentId).catch(() => null);
  if (!newCmu) return null; // not a FON CMU record → manual degree, can't verify
  const newBday = normalizeCmuBirthday(newCmu.birthday);
  if (!newBday) return null; // CMU record has no birthday → can't disprove → allow

  const refBday = await resolveReferenceBirthday(check);
  if (!refBday) return null; // no reference birthday → can't disprove → allow

  if (newBday !== refBday) {
    return "รหัสนักศึกษานี้เป็นของบุคคลอื่น (วันเกิดไม่ตรงกับข้อมูลของท่าน) ไม่สามารถบันทึกเป็นหลักสูตรของท่านได้";
  }
  return null;
}

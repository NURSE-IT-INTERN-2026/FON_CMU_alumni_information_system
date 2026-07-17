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
import prisma from "@/lib/prisma";
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

/**
 * Claim guard — separate from the birthday (same-person) check above. The
 * birthday guard intentionally FAILS OPEN (returns null = allow) whenever CMU
 * can't supply a birthday for both sides (registrar outage, studentId not in
 * CMU, sparse record). That leaves a gap: a `studentId` that is ALREADY another
 * alumni's education record would slip past it and only be caught at insert
 * time by the `studentId @unique` constraint, with a generic message and no
 * pre-save preview. This guard closes that gap: it is DB-only and deterministic,
 * so it always knows whether the `studentId` is already claimed.
 *
 * `Education.studentId` is globally `@unique`, so a studentId can belong to at
 * most ONE alumni. `excludeEducationId` skips the row currently being edited
 * (an edit that keeps the same studentId must not trip its own row).
 */
export interface EducationClaimOwner {
  educationId: string;
  alumniId: string;
}

export async function findStudentIdClaimOwner(
  studentId: string,
  excludeEducationId?: string,
): Promise<EducationClaimOwner | null> {
  const row = await prisma.education.findUnique({
    where: { studentId },
    select: { id: true, alumniId: true },
  });
  if (!row) return null;
  if (excludeEducationId && row.id === excludeEducationId) return null;
  return { educationId: row.id, alumniId: row.alumniId };
}

/**
 * The message shown when the `studentId` is already another alumni's education.
 * Alumni are told to contact the admin (they can't resolve a claim themselves);
 * admins are told WHO owns it so they can fix the conflict directly.
 */
export function claimedByOtherMessage(opts: {
  forAdmin: boolean;
  ownerName?: string;
}): string {
  return opts.forAdmin
    ? `รหัสนักศึกษานี้ถูกลงทะเบียนเป็นประวัติการศึกษาของศิษย์เก่า ${opts.ownerName ?? "ท่านอื่น"} แล้ว กรุณาตรวจสอบและแก้ไขข้อมูลให้ถูกต้อง`
    : "รหัสนักศึกษานี้ถูกลงทะเบียนเป็นประวัติการศึกษาของศิษย์เก่าท่านอื่นแล้ว หากท่านพบว่าเป็นข้อมูลของท่าน กรุณาติดต่อผู้ดูแลระบบ";
}

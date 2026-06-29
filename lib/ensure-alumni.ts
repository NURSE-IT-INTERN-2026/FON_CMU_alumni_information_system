import prisma from "@/lib/prisma";
import { fetchCmuGraduates, type CmuGraduate } from "@/lib/cmu-registrar";
import { ensurePrimaryEducationFromSnapshot } from "@/lib/education-sync";
import {
  cmuLevelToDegree,
  normalizeCmuBirthday,
  type DegreeLevelValue,
} from "@/lib/alumni-verify";

// ---------------------------------------------------------------------------
// CMU lookup map (cached per process; the underlying fetch is 5-min cached)
// ---------------------------------------------------------------------------

let cmuMapPromise: Promise<Map<string, CmuGraduate>> | null = null;

/**
 * Build (once) and return a studentId → CmuGraduate map from the Registrar API.
 * On any error returns an empty map so imports never hard-fail when CMU is down
 * — the row simply imports without CMU enrichment.
 */
export async function getCmuLookupMap(): Promise<Map<string, CmuGraduate>> {
  if (!cmuMapPromise) {
    cmuMapPromise = fetchCmuGraduates()
      .then((grads) => {
        const map = new Map<string, CmuGraduate>();
        for (const g of grads) {
          const sid = String(g.student_id ?? "").trim();
          if (sid) map.set(sid, g);
        }
        return map;
      })
      .catch((err) => {
        console.error(
          "ensure-alumni: CMU lookup failed, continuing without sync",
          err,
        );
        return new Map<string, CmuGraduate>();
      });
  }
  return cmuMapPromise;
}

/** Drop the cached map (mainly for long-lived dev sessions / manual testing). */
export function resetCmuLookupCache(): void {
  cmuMapPromise = null;
}

// ---------------------------------------------------------------------------
// CMU → alumni field mapping
// ---------------------------------------------------------------------------

/** sex_id "1" is male, everything else reads as female in the Registrar data. */
function prefixFromSex(sexId: string | null | undefined): string {
  return String(sexId ?? "").trim() === "1" ? "นาย" : "นางสาว";
}

/** The alumni fields we can derive from a CMU Registrar record. */
export interface CmuAlumniFields {
  prefix: string;
  firstName: string;
  lastName: string;
  englishName: string | null;
  degreeLevel: DegreeLevelValue;
  major: string | null;
  graduationYear: number | null;
  cohort: string | null;
  birthDate: string | null;
  cmuEmail: string | null;
}

/** Map a CMU Registrar record to the alumni fields we can derive from it. */
export function cmuToAlumniFields(g: CmuGraduate): CmuAlumniFields {
  const major = (g.major_name_th ?? "").trim() || null;
  const gradYearStr = (g.grad_year ?? "").trim();
  const gradYearNum = Number(gradYearStr);
  const englishName = [g.name_en, g.surname_en]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return {
    prefix: prefixFromSex(g.sex_id),
    firstName: (g.name_th ?? "").trim(),
    lastName: (g.surname_th ?? "").trim(),
    englishName: englishName || null,
    degreeLevel: cmuLevelToDegree(g.level_id, g.major_name_th),
    major,
    graduationYear: Number.isFinite(gradYearNum) && gradYearNum > 0 ? gradYearNum : null,
    cohort: gradYearStr || null,
    birthDate: normalizeCmuBirthday(g.birthday),
    cmuEmail: (g.cmuitaccount ?? "").trim() || null,
  };
}

/** Fall-back name split when there is no CMU record to derive names from. */
function splitFullName(
  fullName: string,
): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || "ไม่ทราบ",
    lastName: parts.slice(1).join(" ") || "ไม่ทราบ",
  };
}

const isEmpty = (v: string | null | undefined): boolean =>
  v === null || v === undefined || String(v).trim() === "";

/**
 * Ensure an Alumni row exists for `studentId`, enriching it with CMU Registrar
 * data (major, degree, grad year, names, …). Returns the alumni record so
 * callers can copy `major` onto related rows.
 *
 * Existing rows are only **backfilled** — fields that are currently empty get
 * CMU values, but nothing already set is ever overwritten. On a fresh database
 * every field is empty, so a full CMU profile is written.
 */
export async function ensureAlumni(studentId: string, fullName: string) {
  const sid = studentId.trim();
  const existing = await prisma.alumni.findUnique({ where: { studentId: sid } });

  // Best-effort CMU lookup (absent when the API is down or student unknown).
  let cmu: CmuGraduate | undefined;
  try {
    cmu = (await getCmuLookupMap()).get(sid);
  } catch {
    cmu = undefined;
  }

  if (existing) {
    if (!cmu) return existing;
    const f = cmuToAlumniFields(cmu);
    // Backfill only currently-empty fields — never clobber an existing value.
    const update: Record<string, unknown> = {};
    if (isEmpty(existing.major) && f.major) update.major = f.major;
    if (isEmpty(existing.degreeLevel) && f.degreeLevel) update.degreeLevel = f.degreeLevel;
    if (existing.graduationYear == null && f.graduationYear) update.graduationYear = f.graduationYear;
    if (isEmpty(existing.cohort) && f.cohort) update.cohort = f.cohort;
    if (isEmpty(existing.birthDate) && f.birthDate) update.birthDate = f.birthDate;
    if (isEmpty(existing.englishName) && f.englishName) update.englishName = f.englishName;
    if (isEmpty(existing.cmuEmail) && f.cmuEmail) update.cmuEmail = f.cmuEmail;
    if (isEmpty(existing.prefix) && f.prefix) update.prefix = f.prefix;
    if (isEmpty(existing.firstName) && f.firstName) update.firstName = f.firstName;
    if (isEmpty(existing.lastName) && f.lastName) update.lastName = f.lastName;
    if (Object.keys(update).length === 0) return existing;
    return prisma.alumni.update({ where: { id: existing.id }, data: update });
  }

  // Create path: prefer CMU data, fall back to the supplied fullName for names.
  if (cmu) {
    const f = cmuToAlumniFields(cmu);
    const fallback = splitFullName(fullName);
    const created = await prisma.alumni.create({
      data: {
        studentId: sid,
        prefix: f.prefix || "นางสาว",
        firstName: f.firstName || fallback.firstName,
        lastName: f.lastName || fallback.lastName,
        englishName: f.englishName,
        degreeLevel: f.degreeLevel,
        major: f.major,
        graduationYear: f.graduationYear,
        cohort: f.cohort,
        birthDate: f.birthDate,
        cmuEmail: f.cmuEmail,
      },
    });
    // Every new alumni gets a primary Education row mirroring its snapshot.
    await ensurePrimaryEducationFromSnapshot(created.id);
    return created;
  }

  // No CMU data available — legacy stub.
  const fallback = splitFullName(fullName);
  const created = await prisma.alumni.create({
    data: {
      studentId: sid,
      prefix: "นางสาว",
      firstName: fallback.firstName,
      lastName: fallback.lastName,
      degreeLevel: "BACHELOR",
    },
  });
  await ensurePrimaryEducationFromSnapshot(created.id);
  return created;
}

import { THAILAND_DEFAULT_COUNTRY } from "@/lib/alumni-agency-region";

export interface ParsedAlumniAgencyRow {
  cohort: string | null;
  prefix: string | null;
  firstName: string | null;
  lastName: string | null;
  englishName: string | null;
  workplace: string | null;
  province: string | null;
  position: string | null;
  homeAddress: string | null;
  country: string;
  notes: string | null;
  order: number | null;
  /** Optional studentId — when present, the import links the row to an alumni
   *  record (if one exists) and back-fills `major` from it. */
  studentId: string | null;
  major: string | null;
  /** Set by the IMPORT route (not the parser) when `studentId` has no matching
   *  `Alumni` row — the "no Alumni to link to" flag. Always null from the parser. */
  pendingStudentId: string | null;
}

export function inferCountry(wp: string): string {
  const w = wp.toLowerCase();
  if (w.includes("australia") || w.includes("brisbane") || w.includes("perth")) return "ออสเตรเลีย";
  if (w.includes("canada")) return "แคนาดา";
  if (w.includes("denmark")) return "เดนมาร์ก";
  if (w.includes("new zealand")) return "นิวซีแลนด์";
  if (w.includes("france") || w.includes("paris")) return "ฝรั่งเศส";
  if (w.includes("japan")) return "ญี่ปุ่น";
  if (
    w.includes("usa") ||
    w.includes("u.s.a") ||
    w.includes("california") ||
    w.includes("chicago") ||
    w.includes("texas") ||
    w.includes("new york") ||
    w.includes("illinois") ||
    w.includes("florida") ||
    w.includes("pennsylvania") ||
    w.includes("georgia") ||
    w.includes("missouri") ||
    w.includes("connecticut") ||
    w.includes("maryland") ||
    w.includes("washington") ||
    w.includes("nevada") ||
    w.includes("indiana") ||
    w.includes("kansas")
  )
    return "สหรัฐอเมริกา";
  // Unknown workplace — don't fabricate a country (was "สหรัฐอเมริกา"). Blank
  // lands the row on the abroad tab with an empty country for an admin to fix.
  return "";
}

export function isOriginalFormat(rawRows: (string | number)[][]): boolean {
  const header = rawRows[0] || [];
  const h = header.map((v) => String(v || "").trim());
  return !h.includes("คำนำหน้า") && !h.includes("ประเทศ");
}

/**
 * Split a combined "firstName lastName" string into parts. AlumniAgency carries
 * the title prefix in its own column, so this intentionally does NOT strip
 * titles (unlike `splitFullName` in lib/parse-name).
 */
function splitFirstLast(raw: string): { firstName: string | null; lastName: string | null } {
  const parts = raw.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || null };
}

export function parseOriginalFormat(
  rows: (string | number)[][]
): { data: ParsedAlumniAgencyRow; rowNumber: number }[] {
  const result: { data: ParsedAlumniAgencyRow; rowNumber: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const cohort = String(r[0] || "").trim() || null;
    const prefix = String(r[1] || "").trim() || null;
    const { firstName, lastName } = splitFirstLast(String(r[2] || ""));
    const englishName = String(r[3] || "").trim() || null;
    const workplace = String(r[4] || "").trim() || null;
    const homeAddress = String(r[5] || "").trim() || null;
    const notes = String(r[6] || "").trim() || null;
    const country = inferCountry(workplace || "");
    result.push({
      data: { cohort, prefix, firstName, lastName, englishName, workplace, province: null, position: null, homeAddress, country, notes, order: i, studentId: null, major: null, pendingStudentId: null },
      rowNumber: i + 1,
    });
  }
  return result;
}

export function parseExportFormat(
  rows: Record<string, string>[]
): { data: ParsedAlumniAgencyRow; rowNumber: number }[] {  const result: { data: ParsedAlumniAgencyRow; rowNumber: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const province = row["จังหวัด"]?.toString().trim() || null;
    // A Thailand-tab export carries จังหวัด but no ประเทศ — infer ประเทศไทย so
    // it round-trips (otherwise the import skips rows with no country).
    const country =
      row["ประเทศ"]?.toString().trim() || (province ? THAILAND_DEFAULT_COUNTRY : "");

    // Prefer the split ชื่อ/นามสกุล columns; fall back to a legacy ชื่อไทย column.
    const firstNameCol = row["ชื่อ"]?.toString().trim();
    const lastNameCol = row["นามสกุล"]?.toString().trim();
    const legacyThai = row["ชื่อไทย"]?.toString().trim();
    let firstName: string | null = firstNameCol || null;
    let lastName: string | null = lastNameCol || null;
    if (!firstName && !lastName && legacyThai) {
      const split = splitFirstLast(legacyThai);
      firstName = split.firstName;
      lastName = split.lastName;
    }
    const englishName = row["ชื่ออังกฤษ"]?.toString().trim() || null;

    if (!country) continue;
    if (!firstName && !lastName && !englishName) continue;

    const orderStr = row["ลำดับ"]?.toString().trim() || "";
    const orderNum = parseInt(orderStr, 10);
    // `order` is nullable: a Thailand/Abroad-tab export has no ลำดับ column, so
    // absence → null (the import's update payload then omits it to preserve the
    // existing order — see agencyUpdatePayload).
    const order: number | null = orderStr && !isNaN(orderNum) ? orderNum : null;

    result.push({
      data: {
        cohort: row["รุ่น"]?.toString().trim() || null,
        prefix: row["คำนำหน้า"]?.toString().trim() || null,
        firstName,
        lastName,
        englishName,
        workplace: row["สถานที่ทำงาน"]?.toString().trim() || null,
        position: row["ตำแหน่ง"]?.toString().trim() || null,
        province,
        homeAddress: row["ที่อยู่บ้าน"]?.toString().trim() || null,
        country,
        notes: row["หมายเหตุ"]?.toString().trim() || null,
        order,
        studentId: row["รหัสนักศึกษา"]?.toString().trim() || null,
        major: row["สาขาวิชา"]?.toString().trim() || null,
        pendingStudentId: null,
      },
      rowNumber: i + 2,
    });
  }
  return result;
}

/**
 * Build the Prisma `where` for finding an existing ACTIVE AlumniAgency row to
 * UPDATE on (re-)import — so imports are idempotent and don't duplicate.
 *
 * Matches by the resolved id (linked `studentId`, or `pendingStudentId`) OR by
 * firstName+lastName when the existing row carries NO id at all. That name
 * fallback is what stops a re-import from duplicating: e.g. importing the mock
 * fixtures (rows now carrying a pending id) over the real name-only records
 * UPDATES those records instead of creating a second row per person.
 *
 * The name clause is restricted to id-less rows (`studentId: null,
 * pendingStudentId: null`) so two DIFFERENT id'd people who happen to share a
 * name are never merged into one row.
 */
export function alumniAgencyMatchWhere(data: {
  studentId: string | null;
  pendingStudentId: string | null;
  firstName: string | null;
  lastName: string | null;
}): Record<string, unknown> {
  const idClause = data.studentId
    ? { studentId: data.studentId }
    : data.pendingStudentId
      ? { pendingStudentId: data.pendingStudentId }
      : null;
  return {
    deletedAt: null,
    OR: [
      ...(idClause ? [idClause] : []),
      {
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        studentId: null,
        pendingStudentId: null,
      },
    ],
  };
}

// ─── Export column contract ────────────────────────────────────────────────
// The alumni-agency page has two tabs (Thailand / Abroad) that differ in ONE
// column: the location slot is จังหวัด (Thailand) or ประเทศ (Abroad). The export
// is region-aware — `?region=thailand`/`?region=abroad` emit that tab's columns;
// the POST bulk export + a region-less GET emit the full superset (both location
// columns + the internal ลำดับ/order). `buildExcelResponse` derives column order
// from `Object.keys(rows[0])`, so `agencyToExportRow` emitting only the chosen
// columns in order IS the exported layout.

/** An alumni-agency row's export-relevant fields (loose, client-safe + testable). */
export interface AgencyExportShape {
  studentId: string | null;
  pendingStudentId: string | null;
  cohort: string | null;
  prefix: string | null;
  firstName: string | null;
  lastName: string | null;
  englishName: string | null;
  major: string | null;
  workplace: string | null;
  position: string | null;
  province: string | null;
  homeAddress: string | null;
  country: string;
  notes: string | null;
  order: number | null;
}

/** Thailand tab (12) — จังหวัด in the location slot, no ประเทศ, no ลำดับ. */
export const AGENCY_THAILAND_COLUMNS = [
  "รหัสนักศึกษา", "รุ่น", "สาขาวิชา", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่ออังกฤษ",
  "จังหวัด", "สถานที่ทำงาน", "ตำแหน่ง", "ที่อยู่บ้าน", "หมายเหตุ",
] as const;

/** Abroad tab (12) — ประเทศ in the location slot, no จังหวัด, no ลำดับ. */
export const AGENCY_ABROAD_COLUMNS = [
  "รหัสนักศึกษา", "รุ่น", "สาขาวิชา", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่ออังกฤษ",
  "ประเทศ", "สถานที่ทำงาน", "ตำแหน่ง", "ที่อยู่บ้าน", "หมายเหตุ",
] as const;

/** Full superset (14) — both location columns + ลำดับ(order); POST + region-less GET. */
export const AGENCY_FULL_COLUMNS = [
  "รหัสนักศึกษา", "รุ่น", "สาขาวิชา", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่ออังกฤษ",
  "จังหวัด", "ประเทศ", "สถานที่ทำงาน", "ตำแหน่ง", "ที่อยู่บ้าน", "หมายเหตุ", "ลำดับ",
] as const;

const AGENCY_CELL: Record<string, (a: AgencyExportShape) => string | number> = {
  "รหัสนักศึกษา": (a) => a.studentId || a.pendingStudentId || "",
  "รุ่น": (a) => a.cohort || "",
  "สาขาวิชา": (a) => a.major || "",
  "คำนำหน้า": (a) => a.prefix || "",
  "ชื่อ": (a) => a.firstName || "",
  "นามสกุล": (a) => a.lastName || "",
  "ชื่ออังกฤษ": (a) => a.englishName || "",
  "จังหวัด": (a) => a.province || "",
  "ประเทศ": (a) => a.country,
  "สถานที่ทำงาน": (a) => a.workplace || "",
  "ตำแหน่ง": (a) => a.position || "",
  "ที่อยู่บ้าน": (a) => a.homeAddress || "",
  "หมายเหตุ": (a) => a.notes || "",
  "ลำดับ": (a) => a.order ?? 0,
};

/** Map an alumni-agency row to an export row keyed by the chosen column list. */
export function agencyToExportRow(
  a: AgencyExportShape,
  columns: readonly string[],
): Record<string, string | number> {
  const row: Record<string, string | number> = {};
  for (const col of columns) row[col] = AGENCY_CELL[col](a);
  return row;
}

// ─── Import write payloads ─────────────────────────────────────────────────
// `order` is nullable (absent ลำดับ → null). On CREATE it must have a value
// (Int required) so default to 0; on UPDATE, omit it when null so a tab-export
// re-import preserves the existing order instead of resetting it to 0.

/** CREATE payload — `order` defaults to 0 when the row had no ลำดับ column. */
export function agencyCreatePayload(r: { data: ParsedAlumniAgencyRow }): Record<string, unknown> {
  return { ...r.data, order: r.data.order ?? 0 };
}

/** UPDATE payload — omits `order` when null so an existing order is preserved. */
export function agencyUpdatePayload(r: { data: ParsedAlumniAgencyRow }): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...r.data };
  if (r.data.order == null) delete payload.order;
  return payload;
}

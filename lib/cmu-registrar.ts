/**
 * CMU Registrar graduate data — now a LOCAL materialized cache (table
 * `cmu_graduates`), refreshed on demand by an admin from /management/cmu-sync.
 *
 * Historically this module fetched the registrar LIVE on every dashboard /
 * all-alumni-table load (virtual, never persisted). It now persists the
 * FON-filtered registrar universe locally and every consumer reads from it.
 * The ONLY live call that remains is `fetchCmuGraduatesLive()`, used solely by
 * the sync route (POST /api/cmu-alumni/sync) to refresh the table.
 *
 * The `CmuGraduate` interface is kept byte-for-byte so every PURE consumer
 * (`dedupeCmuGraduatesByPerson`, `groupPersonsByDegree`, `cmuToAlumniFields`,
 * sort/facet logic) works unchanged; persisted rows are mapped INTO this shape
 * by `cmuGraduateRowToShape`.
 */

import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CmuGraduate {
  student_id: string;
  // ALL of this person's student_ids (one per FON degree), populated by
  // dedupeCmuGraduatesByPerson on the KEPT (highest-degree) record so consumers
  // can bridge the person on any of their degrees — not just the kept one.
  // Raw records (live OR materialized) leave this undefined.
  student_ids?: string[];
  // --- Persisted (always present on a materialized row) ---
  birthday: string;
  cmuitaccount: string;
  sex_id: string;
  name_th: string;
  surname_th: string;
  name_en: string;
  surname_en: string;
  level_id: string;
  major_name_th: string;
  grad_date: string;
  grad_year: string;
  // --- NOT persisted (declared optional so `cmuGraduateRowToShape` can omit
  //     them; `fetchCmuGraduatesLive` filters on `faculty_id`). Verified live
  //     (2026-07): the `student_grad` API carries NO phone or email field —
  //     `std_phone`/`std_mobile` below are retained for fixture compatibility
  //     but are NEVER populated by the real API. Contact email/phone for the
  //     all-alumni table come ONLY from local `Alumni` data (legacy import →
  //     contactEmail/phones; signup → email). `cmuitaccount` is a CMU IT
  //     account, not a contact email. ---
  middle_name_th?: string;
  middle_name_en?: string;
  faculty_id?: string;
  major_id?: string;
  major_sub_name_th?: string;
  curriculum_id?: string;
  grad_semester?: string;
  study_time_id?: string;
  plan_id?: string;
  plan_name_th?: string;
  std_phone?: string;
  std_mobile?: string;
  grad_school?: string;
  grad_province?: string;
  grad_program?: string;
  grad_gpa?: string;
  adm_type?: string;
}

/**
 * Structural view of a `cmu_graduates` row — the fields we persist. The real
 * Prisma row type is structurally compatible (it has all of these), so the
 * mapper accepts `findMany`/`findUnique` output directly while staying pure and
 * unit-testable with a plain fake object.
 */
export interface CmuGraduateRow {
  studentId: string;
  nameTh: string;
  surnameTh: string;
  birthday: string;
  levelId: string;
  majorNameTh: string;
  gradYear: string;
  sexId: string | null;
  cmuitAccount: string | null;
  nameEn: string | null;
  surnameEn: string | null;
  gradDate: string | null;
  deletedAt: Date | null;
}

/**
 * Map a persisted `cmu_graduates` row into the live `CmuGraduate` shape so every
 * existing pure consumer (dedupe, group-by-degree, cmuToAlumniFields, sort,
 * facets) works UNCHANGED. Unpersisted fields are empty strings — same as a
 * sparse live record (every consumer only reads the 12 fields we store).
 */
export function cmuGraduateRowToShape(r: CmuGraduateRow): CmuGraduate {
  return {
    student_id: r.studentId,
    birthday: r.birthday,
    cmuitaccount: r.cmuitAccount ?? "",
    sex_id: r.sexId ?? "",
    name_th: r.nameTh,
    surname_th: r.surnameTh,
    name_en: r.nameEn ?? "",
    surname_en: r.surnameEn ?? "",
    level_id: r.levelId,
    major_name_th: r.majorNameTh,
    grad_year: r.gradYear,
    grad_date: r.gradDate ?? "",
    // remaining ~18 fields intentionally omitted (dropped, unused by consumers)
  };
}

// ---------------------------------------------------------------------------
// Live-fetch helpers (used ONLY by the sync route)
// ---------------------------------------------------------------------------

function getEnvConfig() {
  const baseUrl = process.env.CMU_REG_API_BASE_URL;
  const token = process.env.CMU_REG_API_TOKEN;
  const accountName = process.env.CMU_REG_API_ACCOUNT_NAME;
  const apiId = process.env.CMU_REG_API_ID;

  if (!baseUrl || !token || !accountName || !apiId) {
    throw new Error("Missing CMU Registrar API configuration in environment variables");
  }

  return { baseUrl, token, accountName, apiId };
}

function getFacultyId(): string {
  return process.env.CMU_FON_FACULTY_ID || "12";
}

async function fetchFromCmuApi(
  url: string,
  method: "GET" | "POST" = "POST",
): Promise<unknown> {
  const { token, accountName, apiId } = getEnvConfig();

  const auth = new URLSearchParams();
  auth.append("cmuaccount_name", accountName);
  auth.append("api_id", apiId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  // GET/HEAD cannot carry a body (undici throws "Request with GET/HEAD method
  // cannot have body") — pass the auth params as a query string for GET, and in
  // the body for POST.
  const isGet = method === "GET";
  const finalUrl = isGet
    ? `${url}${url.includes("?") ? "&" : "?"}${auth.toString()}`
    : url;

  try {
    const response = await fetch(finalUrl, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(isGet ? {} : { "Content-Type": "application/x-www-form-urlencoded" }),
      },
      body: isGet ? undefined : auth.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`CMU API responded with status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * LIVE fetch of all FON graduates from the CMU Registrar. Used ONLY by the sync
 * route to refresh `cmu_graduates`. (No in-memory cache — the DB is the cache.)
 */
export async function fetchCmuGraduatesLive(): Promise<CmuGraduate[]> {
  const { baseUrl } = getEnvConfig();
  const facultyId = getFacultyId();

  const raw = await fetchFromCmuApi(baseUrl, "POST");

  // The API may return an array or a single object wrapped in an array
  let records: CmuGraduate[];
  if (Array.isArray(raw)) {
    records = raw as CmuGraduate[];
  } else if (raw && typeof raw === "object") {
    records = [raw as CmuGraduate];
  } else {
    records = [];
  }

  // Filter to FON graduates only
  return records.filter((r) => String(r.faculty_id) === facultyId);
}

// ---------------------------------------------------------------------------
// Local reads (the materialized registrar universe) — every consumer uses these
// ---------------------------------------------------------------------------

/** All CMU graduates from the LOCAL `cmu_graduates` table. Returns [] before
 *  the first admin sync — callers treat empty as "not yet synced" (surfaced via
 *  `fetchCmuGraduatesOrEmpty`'s `available` flag / the dashboard banner). */
export async function getCmuGraduatesLocal(): Promise<CmuGraduate[]> {
  const rows = await prisma.cmuGraduate.findMany({ where: { deletedAt: null } });
  return rows.map((r) => cmuGraduateRowToShape(r));
}

/** One local graduate by studentId (trimmed), or null if absent / soft-deleted. */
export async function getCmuGraduateLocalById(
  studentId: string,
): Promise<CmuGraduate | null> {
  const sid = String(studentId ?? "").trim();
  if (!sid) return null;
  const row = await prisma.cmuGraduate.findUnique({ where: { studentId: sid } });
  return row && row.deletedAt == null ? cmuGraduateRowToShape(row) : null;
}

// ---------------------------------------------------------------------------
// Sync diff (pure — unit-testable; used by GET /api/cmu-alumni/sync)
// ---------------------------------------------------------------------------

export interface CmuSyncDiffSample {
  studentId: string;
  name: string;
  level_id: string;
  grad_year: string;
}

export interface CmuSyncDiff {
  remoteCount: number; // distinct remote studentIds
  localCount: number; // distinct local studentIds
  newCount: number; // remote studentIds not present locally
  removedCount: number; // local studentIds no longer on remote
  inSync: boolean; // set + count equality (excludes local-not-CMU data by design)
  sample: CmuSyncDiffSample[]; // first 50 "new" records
}

/**
 * Compare the remote registrar universe against the LOCAL `cmu_graduates`
 * studentId set. "In alignment" ⟺ the two studentId sets are equal. Local-only
 * alumni (no CMU record) are inherently excluded — they are not in
 * `cmu_graduates`, so they never affect this comparison.
 */
export function diffCmuGraduates(
  remote: CmuGraduate[],
  localIds: string[],
): CmuSyncDiff {
  const trim = (s: unknown) => String(s ?? "").trim();

  const remoteIds = new Set<string>();
  for (const g of remote) {
    const sid = trim(g.student_id);
    if (sid) remoteIds.add(sid);
  }
  const localIdsSet = new Set<string>();
  for (const s of localIds) {
    const sid = trim(s);
    if (sid) localIdsSet.add(sid);
  }

  const newIdsSet = new Set<string>();
  for (const sid of remoteIds) if (!localIdsSet.has(sid)) newIdsSet.add(sid);
  let removedCount = 0;
  for (const sid of localIdsSet) if (!remoteIds.has(sid)) removedCount++;

  const sample: CmuSyncDiffSample[] = [];
  for (const g of remote) {
    const sid = trim(g.student_id);
    if (sid && newIdsSet.has(sid)) {
      sample.push({
        studentId: sid,
        name: `${g.name_th ?? ""} ${g.surname_th ?? ""}`.trim(),
        level_id: g.level_id,
        grad_year: g.grad_year,
      });
      if (sample.length >= 50) break;
    }
  }

  const newCount = newIdsSet.size;
  return {
    remoteCount: remoteIds.size,
    localCount: localIdsSet.size,
    newCount,
    removedCount,
    inSync:
      newCount === 0 &&
      removedCount === 0 &&
      remoteIds.size === localIdsSet.size,
    sample,
  };
}

// ---------------------------------------------------------------------------
// Degree mapping
// ---------------------------------------------------------------------------

/**
 * Map a CMU Registrar record's `level_id` (+ `major_name_th`) to our local
 * `DegreeLevel` enum value. Mirrors the predicate in the `/api/cmu-alumni`
 * route so filtering, the table view, and facet counts all agree.
 *
 *   level_id 5            → DOCTORAL
 *   level_id 3            → MASTER
 *   level_id 1            → BACHELOR
 *   level_id 2            → NURSING_ASSISTANT
 *   level_id 0 + nursing  → NURSING_ASSISTANT
 *   level_id 0 (other)    → ASSOCIATE
 *
 * Returns null if the level_id is unrecognized (so it is skipped in counts).
 */
export function cmuLevelToEnum(
  level_id: string,
  major_name_th: string,
): "DOCTORAL" | "MASTER" | "BACHELOR" | "NURSING_ASSISTANT" | "ASSOCIATE" | null {
  switch (level_id) {
    case "5":
      return "DOCTORAL";
    case "3":
      return "MASTER";
    case "1":
      return "BACHELOR";
    case "2":
      return "NURSING_ASSISTANT";
    case "0":
      return major_name_th === "ประกาศนียบัตรผู้ช่วยพยาบาล"
        ? "NURSING_ASSISTANT"
        : "ASSOCIATE";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public read API (names kept; bodies now read LOCAL)
// ---------------------------------------------------------------------------

export interface CmuGraduatesResult {
  graduates: CmuGraduate[];
  /**
   * `available` now means "the local `cmu_graduates` table has data" (i.e. an
   * admin has run at least one sync). Pre-first-sync it is false → the dashboard
   * shows its "ยังไม่ได้ดึงข้อมูล CMU" banner and counts local alumni only.
   */
  available: boolean;
}

/**
 * All CMU graduates from the local table, fail-safe. `available` reflects
 * whether the table is populated (not Registrar reachability — that no longer
 * applies since reads are local).
 */
export async function fetchCmuGraduatesOrEmpty(): Promise<CmuGraduatesResult> {
  const graduates = await getCmuGraduatesLocal();
  return { graduates, available: graduates.length > 0 };
}

/**
 * Fetch a single graduate by student ID from the LOCAL `cmu_graduates` table
 * (trimmed). Returns null if not found or soft-deleted. Identity checks
 * (signup/approve/reverify/education) read this; a brand-new graduate not yet
 * synced won't be found — those checks already fail open and are admin-gated.
 */
export async function fetchCmuGraduateById(
  studentId: string,
): Promise<CmuGraduate | null> {
  return getCmuGraduateLocalById(studentId);
}

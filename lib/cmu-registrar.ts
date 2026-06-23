/**
 * Helper for fetching alumni data from the CMU Registrar API (student_grad).
 * This is a read-only proxy — data is never persisted to our database.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CmuGraduate {
  student_id: string;
  birthday: string;
  cmuitaccount: string;
  sex_id: string;
  name_th: string;
  middle_name_th: string;
  surname_th: string;
  name_en: string;
  middle_name_en: string;
  surname_en: string;
  level_id: string;
  faculty_id: string;
  major_id: string;
  major_name_th: string;
  major_sub_name_th: string;
  curriculum_id: string;
  grad_date: string;
  grad_year: string;
  grad_semester: string;
  study_time_id: string;
  plan_id: string;
  plan_name_th: string;
  std_phone: string;
  std_mobile: string;
  grad_school: string;
  grad_province: string;
  grad_program: string;
  grad_gpa: string;
  adm_type: string;
}

// ---------------------------------------------------------------------------
// In-memory cache (5-minute TTL) for the full graduate list
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: CmuGraduate[];
  expiresAt: number;
}

let listCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Internal helpers
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all FON graduates from the CMU Registrar API.
 * Results are cached in memory for 5 minutes to reduce external API calls.
 */
export async function fetchCmuGraduates(): Promise<CmuGraduate[]> {
  // Return cached data if still fresh
  if (listCache && Date.now() < listCache.expiresAt) {
    return listCache.data;
  }

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
  const fonGraduates = records.filter(
    (r) => String(r.faculty_id) === facultyId,
  );

  // Update cache
  listCache = {
    data: fonGraduates,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return fonGraduates;
}

/**
 * Fetch a single graduate by student ID from the CMU Registrar API.
 * Returns null if the student is not found or is not a FON graduate.
 */
/**
 * Fetch a single graduate by student ID. Resolves from the cached full graduate
 * list (`fetchCmuGraduates`, already filtered to FON) rather than a per-id GET
 * endpoint — reliable, and shares the 5-min cache with the dashboard / all-alumni
 * table / import flow. CMU `student_id` values carry trailing spaces, so both
 * sides are trimmed before comparing. Returns null if not a FON graduate.
 */
export async function fetchCmuGraduateById(
  studentId: string,
): Promise<CmuGraduate | null> {
  const sid = String(studentId ?? "").trim();
  if (!sid) return null;
  const graduates = await fetchCmuGraduates();
  return (
    graduates.find((g) => String(g.student_id ?? "").trim() === sid) ?? null
  );
}

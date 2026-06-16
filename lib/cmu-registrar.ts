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

  const body = new URLSearchParams();
  body.append("cmuaccount_name", accountName);
  body.append("api_id", apiId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
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
export async function fetchCmuGraduateById(
  studentId: string,
): Promise<CmuGraduate | null> {
  const { baseUrl } = getEnvConfig();
  const facultyId = getFacultyId();

  const raw = await fetchFromCmuApi(`${baseUrl}/${encodeURIComponent(studentId)}`, "GET");

  // The API may return a single object or an array with one entry
  let record: CmuGraduate | null = null;
  if (Array.isArray(raw) && raw.length > 0) {
    record = raw[0] as CmuGraduate;
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    // Check if it's an empty/error response
    if ("student_id" in (raw as Record<string, unknown>)) {
      record = raw as CmuGraduate;
    }
  }

  if (!record) return null;

  // Only return FON graduates
  if (String(record.faculty_id) !== facultyId) return null;

  return record;
}

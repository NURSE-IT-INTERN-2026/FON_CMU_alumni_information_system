import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIp } from "@/lib/activity-log";
import { getCmuGraduatesLocal, cmuLevelToEnum, type CmuGraduate } from "@/lib/cmu-registrar";
import { normalizeCmuBirthday, dedupeCmuGraduatesByPerson } from "@/lib/alumni-verify";
import { PAGE_SIZE } from "@/lib/constants";

const RATE_LIMIT_MAX = 300;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
// Upper bound on pageSize. The all-alumni "manage" mode fetches the full CMU
// list in one request (to merge with local data and paginate the result on the
// client), so this is larger than a typical page. The default stays at
// PAGE_SIZE; this only guards against absurd input.
const MAX_PAGE_SIZE = 50_000;

export async function GET(request: NextRequest) {
  // 1. Auth check
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  // 2. Rate limit
  const ip = getIp(request);
  const rateResult = checkRateLimit(
    `cmu-alumni:${ip}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW,
  );
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateResult.retryAfterMs / 1000)) },
      },
    );
  }

  try {
    // 3. Parse query params
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      1,
      Math.min(MAX_PAGE_SIZE, parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10)),
    );
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const sortField = searchParams.get("sortField") || "student_id";
    const sortDir = searchParams.get("sortDir") || "asc";

    // Facet filters are comma-separated (multi-select) — split into trimmed arrays.
    const facetList = (key: string): string[] =>
      (searchParams.get(key) || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const degreeLevels = facetList("degreeLevel");
    const majors = facetList("major");
    const graduationYears = facetList("graduationYear");

    // 4. Read the LOCAL cmu_graduates table, then (by default) collapse a
    //    person's multiple degree records into their HIGHEST degree (same first
    //    name + last name + birthday). Done on the FULL list before
    //    search/facets/sort/pagination so two records that would land on
    //    different pages still collapse. `?dedupe=false` skips the collapse so
    //    the all-alumni "show all degrees" toggle can list every degree record
    //    (one row per degree); the dashboard count is unaffected (it uses a
    //    separate person-grouping path).
    const dedupe = searchParams.get("dedupe") !== "false";
    const cmuRaw = await getCmuGraduatesLocal();
    const graduates = dedupe ? dedupeCmuGraduatesByPerson(cmuRaw) : cmuRaw;

    // 5. Apply search filter
    let filtered = graduates;
    if (search) {
      filtered = graduates.filter((g: CmuGraduate) => {
        const haystack = [
          g.name_th,
          g.surname_th,
          g.student_id,
          g.name_en,
          g.surname_en,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    // 5b. Apply facet filters (degree level, major, graduation year) — AND-semantics.
    if (degreeLevels.length || majors.length || graduationYears.length) {
      filtered = filtered.filter((g: CmuGraduate) => {
        if (degreeLevels.length && !degreeLevels.includes(cmuLevelToEnum(g.level_id, g.major_name_th) ?? "")) {
          return false;
        }
        if (majors.length && !majors.includes((g.major_name_th ?? "").trim())) {
          return false;
        }
        if (graduationYears.length && !graduationYears.includes((g.grad_year ?? "").trim())) {
          return false;
        }
        return true;
      });
    }

    // 5c. Sort
    const sortFieldMap: Record<string, string> = {
      studentId: "student_id",
      name: "name_th",
      surname: "surname_th",
      degreeLevel: "level_id",
      major: "major_name_th",
      year: "grad_year",
      birthDate: "birthday",
    };
    const orderKey = sortFieldMap[sortField] || "student_id";
    const dir = sortDir === "desc" ? -1 : 1;
    filtered.sort((a: CmuGraduate, b: CmuGraduate) => {
      // CMU "birthday" is MM-DD-YYYY — sort by the normalized YYYY-MM-DD so the
      // order is chronological, not lexicographic on the raw string.
      if (orderKey === "birthday") {
        const da = normalizeCmuBirthday(a.birthday) ?? "";
        const db = normalizeCmuBirthday(b.birthday) ?? "";
        return da.localeCompare(db) * dir;
      }
      const va = String((a as unknown as Record<string, string>)[orderKey] || "");
      const vb = String((b as unknown as Record<string, string>)[orderKey] || "");
      return va.localeCompare(vb, "th") * dir;
    });

    // 6. Paginate. Trim `student_id` on the way out — CMU ids ship with
    // surrounding spaces, and list consumers (the all-alumni table, the alumni
    // search hook) join/merge on student_id against local ids that are already
    // clean. Untrimmed ids break the CMU↔local overlay (so local data never
    // lands on its CMU row) and the same person is double-counted (a CMU-only
    // row AND a local-only row). `ensure-alumni` / `fetchCmuGraduateById` / the
    // dashboard already trim defensively; trimming here keeps the list output
    // consistent so those consumers' keys line up.
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const data = filtered
      .slice(start, start + pageSize)
      .map((g: CmuGraduate) => ({ ...g, student_id: String(g.student_id ?? "").trim() }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("GET /api/cmu-alumni error:", error);

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลศิษย์เก่าจากระบบทะเบียน" },
      { status: 500 },
    );
  }
}

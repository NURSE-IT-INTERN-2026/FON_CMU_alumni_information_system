import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { withTtlCache } from "@/lib/cache";
import { fetchCmuGraduatesLive, type CmuGraduate } from "@/lib/cmu-registrar";
import { PAGE_SIZE } from "@/lib/constants";

// Same upper bound as the list route (the all-alumni "manage" mode fetches the
// full CMU list in one request); only guards against absurd input.
const MAX_PAGE_SIZE = 50_000;

/**
 * LIVE CMU Registrar graduates, server-paginated/searchable — powers the
 * "ข้อมูลล่าสุดจากทะเบียน" table on the cmu-sync page (the second live-CMU call
 * site after `/sync`). `fetchCmuGraduatesLive()` already filters to FON
 * (faculty_id "12"), so this set is apples-to-apples with the local cache.
 *
 * `fetchCmuGraduatesLive` has NO cache and hits CMU on every call, so we wrap it
 * in `withTtlCache` — one CMU call serves every page/search within the TTL
 * window (the dashboard uses the same helper for its aggregations). Errors are
 * NOT cached (`fn` throws before `store.set`), so a transient CMU outage isn't
 * pinned for 2 minutes.
 *
 * Each row carries `isNew` = its trimmed student_id is NOT in the local
 * `cmu_graduates` cache (the records a ดึงข้อมูล would add), so the live table
 * can badge the local-vs-live diff.
 *
 * GET /api/cmu-alumni/live?page=&pageSize=&search=&sortField=&sortDir=
 *   → { data: CmuGraduate[], total, page, pageSize }
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      1,
      Math.min(MAX_PAGE_SIZE, parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10)),
    );
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const sortField = searchParams.get("sortField") || "student_id";
    const sortDir = searchParams.get("sortDir") || "asc";

    // One CMU call per TTL window (shared across pagination/search requests).
    const [live, localRows] = await Promise.all([
      withTtlCache("cmu-live-graduates", 120_000, () => fetchCmuGraduatesLive()),
      prisma.cmuGraduate.findMany({
        where: { deletedAt: null },
        select: { studentId: true },
      }),
    ]);
    const localSet = new Set(localRows.map((r) => r.studentId.trim()));

    // Search (same fields as the list route: name/surname/student_id/EN names).
    let filtered = live;
    if (search) {
      filtered = live.filter((g: CmuGraduate) => {
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

    // Sort — same field map as the list route (no birthday column here).
    const sortFieldMap: Record<string, string> = {
      studentId: "student_id",
      name: "name_th",
      surname: "surname_th",
      degreeLevel: "level_id",
      major: "major_name_th",
      year: "grad_year",
    };
    const orderKey = sortFieldMap[sortField] || "student_id";
    const dir = sortDir === "desc" ? -1 : 1;
    filtered.sort((a: CmuGraduate, b: CmuGraduate) => {
      const va = String((a as unknown as Record<string, string>)[orderKey] || "");
      const vb = String((b as unknown as Record<string, string>)[orderKey] || "");
      return va.localeCompare(vb, "th") * dir;
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize).map((g: CmuGraduate) => {
      const sid = String(g.student_id ?? "").trim();
      return { ...g, student_id: sid, isNew: sid ? !localSet.has(sid) : false };
    });

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("GET /api/cmu-alumni/live error:", error);
    return NextResponse.json(
      { error: "ไม่สามารถติดต่อระบบทะเบียนเพื่อดึงข้อมูลได้ กรุณาลองใหม่ภายหลัง" },
      { status: 502 },
    );
  }
}

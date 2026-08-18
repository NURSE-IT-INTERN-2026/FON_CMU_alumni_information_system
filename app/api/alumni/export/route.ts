import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { buildExcelResponse, resolveRowRange } from "@/lib/excel-export";
import { dedupeCmuGraduatesByPerson } from "@/lib/alumni-verify";
import { getCmuGraduatesLocal, applyCmuGraduateFilters } from "@/lib/cmu-registrar";
import { filterLocalAlumniRows } from "@/lib/alumni-local-filter";
import { mergeAlumniTableRows, type MergedAlumni } from "@/lib/alumni-merge";
import { sortAlumni } from "@/lib/alumni-sort";
import { alumniToExportRow } from "@/lib/alumni-excel";

const MAX_EXPORT_COUNT = 50000;

/** Education fields the merge needs to bridge a local alumni to its CMU person
 *  on any of its degrees (not just the primary snapshot). */
const EDUCATION_SELECT = {
  select: { studentId: true, degreeLevel: true, graduationYear: true, major: true, cohort: true },
} as const;

/**
 * Build the merged CMU + local row set the same way the on-screen all-alumni
 * table does — so the export contains every record the admin sees (including
 * CMU-only persons), filtered/sorted identically. Returns the rows (still
 * merged, before row-range slicing or id filtering).
 */
async function buildMergedRows(
  search: string,
  dedupe: boolean,
  searchParams: URLSearchParams,
): Promise<MergedAlumni[]> {
  // CMU side: read the local cmu_graduates cache, optionally collapse each
  // person to their highest degree, then apply the SAME search + facet filters
  // the /api/cmu-alumni list route applies (applyCmuGraduateFilters is shared).
  const cmuRaw = await getCmuGraduatesLocal();
  const cmuDeduped = dedupe ? dedupeCmuGraduatesByPerson(cmuRaw) : cmuRaw;
  const facetList = (key: string) =>
    (searchParams.get(key) || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const degreeLevels = facetList("degreeLevel");
  const majors = facetList("major");
  const graduationYears = facetList("graduationYear");
  const cmuRows = applyCmuGraduateFilters(cmuDeduped, {
    search,
    degreeLevels,
    majors,
    graduationYears,
  });

  // Local side: the shared client-safe filterLocalAlumniRows (the exact
  // /api/alumni GET where-clause semantics, incl. an education's studentId so a
  // lower-degree id is findable). NO deletedAt filter: the merge needs
  // soft-deleted rows to build the deleted-studentId set and skip them,
  // matching the table's net behavior. Fetch unfiltered then filter in-process
  // — same single Prisma query either way, and the client pipeline + export now
  // run literally one implementation.
  const allLocal = await prisma.alumni.findMany({
    include: { educations: EDUCATION_SELECT },
  });
  const localRows = filterLocalAlumniRows(allLocal, {
    search,
    degreeLevels,
    majors,
    graduationYears,
  });

  return mergeAlumniTableRows(cmuRows, localRows, { dedupeView: dedupe, search });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") || "";
    const dedupe = searchParams.get("dedupe") !== "false";
    const sortField = searchParams.get("sortField") || "studentId";
    const sortDir = searchParams.get("sortDir") === "desc" ? "desc" : "asc";
    const startRow = searchParams.get("startRow");
    const endRow = searchParams.get("endRow");

    const merged = await buildMergedRows(search, dedupe, searchParams);
    const sorted = sortAlumni(merged, sortField, sortDir);
    const { start, end } = resolveRowRange(startRow, endRow, sorted.length);
    const rows = sorted.slice(start - 1, end).map(alumniToExportRow);

    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "alumni",
      null,
      {
        count: rows.length,
        mode: "filtered",
        merged: true,
        dedupe,
        search: search || undefined,
        range: { start, end, total: sorted.length },
      },
    );

    return buildExcelResponse(rows, "ศิษย์เก่า", "alumni_export");
  } catch (error) {
    console.error("GET /api/alumni/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูลศิษย์เก่า" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { ids, dedupe } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเลือกรายการที่ต้องการส่งออก" },
        { status: 400 },
      );
    }
    if (ids.length > MAX_EXPORT_COUNT) {
      return NextResponse.json(
        { error: `ส่งออกได้สูงสุด ${MAX_EXPORT_COUNT} รายการ` },
        { status: 400 },
      );
    }

    const dedupeMode = dedupe !== false;
    // Build the FULL merged set in the caller's dedupe mode (a degree-row id
    // selected in "show all" mode only resolves against the un-deduped merge),
    // then keep the selected rows by id. Merged-row ids are unambiguous: local
    // UUIDs contain "-"; CMU-only ids are numeric student_ids.
    const merged = await buildMergedRows("", dedupeMode, new URLSearchParams());
    const idSet = new Set(ids.map(String));
    const rows = merged.filter((m) => idSet.has(m.id)).map(alumniToExportRow);

    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "alumni",
      null,
      { count: rows.length, mode: "selected", merged: true, dedupe: dedupeMode },
    );

    return buildExcelResponse(rows, "ศิษย์เก่า", "alumni_export");
  } catch (error) {
    console.error("POST /api/alumni/export error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการส่งออกข้อมูลศิษย์เก่า" },
      { status: 500 },
    );
  }
}

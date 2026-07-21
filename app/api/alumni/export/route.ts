import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { buildExcelResponse, resolveRowRange } from "@/lib/excel-export";
import { joinPhones } from "@/lib/parse-phone";
import { formatBirthDateThai, dedupeCmuGraduatesByPerson } from "@/lib/alumni-verify";
import { DEGREE_LEVEL_OPTIONS } from "@/lib/constants";
import { getCmuGraduatesLocal, applyCmuGraduateFilters } from "@/lib/cmu-registrar";
import { mergeAlumniTableRows, type MergedAlumni } from "@/lib/alumni-merge";
import { sortAlumni } from "@/lib/alumni-sort";
import { parseFacetFilters, FACET_FIELDS } from "@/lib/filter-facets";

const MAX_EXPORT_COUNT = 50000;

/** Thai display labels for degree-level enum values — same source as the
 * all-alumni table (lib/constants.ts DEGREE_LEVEL_OPTIONS), so the export
 * label set can never drift from what's shown on screen. */
const DEGREE_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  DEGREE_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
);

/** Education fields the merge needs to bridge a local alumni to its CMU person
 *  on any of its degrees (not just the primary snapshot). */
const EDUCATION_SELECT = {
  select: { studentId: true, degreeLevel: true, graduationYear: true, major: true, cohort: true },
} as const;

function mapRows(alumni: MergedAlumni[]) {
  // Columns mirror the on-screen all-alumni table
  // (app/(admin)/management/all-alumni/page.tsx), same order and value
  // rendering, minus the UI-only ลำดับ (row number) + จัดการ (actions).
  // buildExcelResponse derives columns from Object.keys(rows[0]), so the key
  // set below IS the exported column set.
  return alumni.map((a) => ({
    "รหัสนักศึกษา": a.studentId,
    "รุ่น": a.cohort || "",
    "คำนำหน้า": a.prefix,
    "ชื่อ": a.firstName,
    "นามสกุล": a.lastName,
    "ระดับการศึกษา": a.degreeLevel ? DEGREE_LEVEL_LABELS[a.degreeLevel] ?? a.degreeLevel : "",
    "สาขาวิชา": a.major || "",
    "ปีสำเร็จการศึกษา": a.graduationYear ?? "",
    "วันเกิด": formatBirthDateThai(a.birthDate) ?? "",
    "อีเมลติดต่อ": a.contactEmail || a.email || "",
    "เบอร์โทร": joinPhones(a.phones),
    "หมายเหตุ": a.remarks || "",
  }));
}

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
  const cmuRows = applyCmuGraduateFilters(cmuDeduped, {
    search,
    degreeLevels: facetList("degreeLevel"),
    majors: facetList("major"),
    graduationYears: facetList("graduationYear"),
  });

  // Local side: mirror /api/alumni GET — search OR (incl. an education's
  // studentId so a lower-degree id is findable) + the same facet filters. NO
  // deletedAt filter: the merge needs soft-deleted rows to build the
  // deleted-studentId set and skip them, matching the table's net behavior.
  const where: Prisma.AlumniWhereInput = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { studentId: { contains: search, mode: "insensitive" } },
      { educations: { some: { studentId: { contains: search, mode: "insensitive" } } } },
    ];
  }
  Object.assign(where, parseFacetFilters(searchParams, FACET_FIELDS.alumni));

  const localRows = await prisma.alumni.findMany({
    where,
    include: { educations: EDUCATION_SELECT },
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
    const rows = mapRows(sorted.slice(start - 1, end));

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
    const rows = mapRows(merged.filter((m) => idSet.has(m.id)));

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

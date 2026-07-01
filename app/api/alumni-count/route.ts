import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPersonDegreeBreakdown } from "@/lib/person-degree-count";
import { withTtlCache } from "@/lib/cache";

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
  ASSOCIATE: "อนุปริญญา",
};

const DEGREE_ORDER = ["NURSING_ASSISTANT", "ASSOCIATE", "BACHELOR", "MASTER", "DOCTORAL"];

// The person-degree breakdown scans CMU + all local education/alumni; cache it
// briefly so repeated alumni-count loads share one computation. Bust with
// `bustCache("alumni-count")` if instant freshness is ever required.
const ALUMNI_COUNT_CACHE_TTL_MS = 60_000;

/** Compute (uncached) the alumni-count chart payload. */
async function getAlumniCountData() {
  // Merge CMU + local Education into PERSONS (union-find by name+birthday,
  // alumniId, and shared studentId) so each person counts once under their
  // highest degree — a locally-added higher degree upgrades them.
  const { byDegree, total, byYearDegree, cmuAvailable } =
    await getPersonDegreeBreakdown();

  // Sort years numerically
  const generations = Object.keys(byYearDegree).sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10),
  );

  // Build per-series data: one array per degree level, indexed by year
  const series = DEGREE_ORDER.map((degree) => ({
    key: degree,
    label: DEGREE_LABELS[degree],
    data: generations.map((year) => byYearDegree[year]?.[degree] ?? 0),
  }));

  // Cards data: total per degree level
  const cards = DEGREE_ORDER.map((degree) => ({
    key: degree,
    label: DEGREE_LABELS[degree],
    count: byDegree[degree] ?? 0,
  }));

  return { generations, series, cards, totalCount: total, cmuAvailable };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const payload = await withTtlCache(
      "alumni-count",
      ALUMNI_COUNT_CACHE_TTL_MS,
      getAlumniCountData,
    );
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to fetch alumni count:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni count data" },
      { status: 500 },
    );
  }
}

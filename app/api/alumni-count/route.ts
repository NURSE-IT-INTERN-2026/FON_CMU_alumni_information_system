import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPersonDegreeBreakdown } from "@/lib/person-degree-count";

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
  ASSOCIATE: "อนุปริญญา",
};

const DEGREE_ORDER = ["NURSING_ASSISTANT", "ASSOCIATE", "BACHELOR", "MASTER", "DOCTORAL"];

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    // Merge CMU + local Education into PERSONS (union-find by name+birthday,
    // alumniId, and shared studentId) so each person counts once under their
    // highest degree — a locally-added higher degree upgrades them.
    const { byDegree, total, byYearDegree } = await getPersonDegreeBreakdown();

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

    return NextResponse.json({
      generations,
      series,
      cards,
      totalCount: total,
    });
  } catch (error) {
    console.error("Failed to fetch alumni count:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni count data" },
      { status: 500 },
    );
  }
}

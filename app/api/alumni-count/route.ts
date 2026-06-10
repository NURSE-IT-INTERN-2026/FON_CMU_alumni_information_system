import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchCmuGraduates } from "@/lib/cmu-registrar";

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
  ASSOCIATE: "อนุปริญญา",
};

const DEGREE_ORDER = ["NURSING_ASSISTANT", "ASSOCIATE", "BACHELOR", "MASTER", "DOCTORAL"];

// Map CMU Registrar level_id to local degree level keys
const CMU_LEVEL_MAP: Record<string, string> = {
  "0": "ASSOCIATE",
  "1": "BACHELOR",
  "2": "NURSING_ASSISTANT",
  "3": "MASTER",
  "5": "DOCTORAL",
};

/** Resolve the internal degree key, accounting for the special case where
 *  level_id=0 + major_name_th='ประกาศนียบัตรผู้ช่วยพยาบาล' → NURSING_ASSISTANT. */
function resolveDegreeKey(level_id: string, major_name_th: string): string {
  if (level_id === "0" && major_name_th === "ประกาศนียบัตรผู้ช่วยพยาบาล") {
    return "NURSING_ASSISTANT";
  }
  return CMU_LEVEL_MAP[level_id] ?? "OTHER";
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const graduates = await fetchCmuGraduates();

    // Group by grad_year x degree level
    const grouped: Record<string, Record<string, number>> = {};
    const degreeTotals: Record<string, number> = {};

    for (const g of graduates) {
      const year = (g.grad_year || "").trim();
      if (!year) continue; // skip records without a grad year
      const degree = resolveDegreeKey((g.level_id || "").trim(), (g.major_name_th || "").trim());
      if (!grouped[year]) grouped[year] = {};
      grouped[year][degree] = (grouped[year][degree] || 0) + 1;
      degreeTotals[degree] = (degreeTotals[degree] || 0) + 1;
    }

    // Sort years numerically
    const generations = Object.keys(grouped).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );

    // Build per-series data: one array per degree level, indexed by year
    const series = DEGREE_ORDER.map((degree) => ({
      key: degree,
      label: DEGREE_LABELS[degree],
      data: generations.map((year) => grouped[year][degree] || 0),
    }));

    // Cards data: total per degree level
    const cards = DEGREE_ORDER.map((degree) => ({
      key: degree,
      label: DEGREE_LABELS[degree],
      count: degreeTotals[degree] || 0,
    }));

    const totalCount = Object.values(degreeTotals).reduce(
      (sum, v) => sum + v,
      0
    );

    return NextResponse.json({
      generations,
      series,
      cards,
      totalCount,
    });
  } catch (error) {
    console.error("Failed to fetch alumni count:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni count data" },
      { status: 500 }
    );
  }
}

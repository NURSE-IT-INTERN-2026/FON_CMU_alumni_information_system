import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
};

const DEGREE_ORDER = ["BACHELOR", "MASTER", "DOCTORAL", "NURSING_ASSISTANT"];

export async function GET() {
  try {
    const alumni = await prisma.alumni.findMany({
      select: {
        studentId: true,
        degreeLevel: true,
      },
    });

    // Group by generation (first 2 digits of studentId) x degreeLevel
    const grouped: Record<string, Record<string, number>> = {};
    const degreeTotals: Record<string, number> = {};

    for (const a of alumni) {
      const gen = a.studentId.slice(0, 2);
      const degree = a.degreeLevel!;
      if (!grouped[gen]) grouped[gen] = {};
      grouped[gen][degree] = (grouped[gen][degree] || 0) + 1;
      degreeTotals[degree] = (degreeTotals[degree] || 0) + 1;
    }

    // Sort generations numerically
    const generations = Object.keys(grouped).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );

    // Build per-series data: one array per degree level, indexed by generation
    const series = DEGREE_ORDER.map((degree) => ({
      key: degree,
      label: DEGREE_LABELS[degree],
      data: generations.map((gen) => grouped[gen][degree] || 0),
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

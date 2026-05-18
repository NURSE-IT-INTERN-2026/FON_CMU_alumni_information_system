import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const alumni = await prisma.alumni.findMany({
      select: {
        cohort: true,
      },
    });

    const cohortSet = new Set<string>();
    const grouped: Record<string, number> = {};

    for (const a of alumni) {
      const cohort = a.cohort || "ไม่ระบุรุ่น";
      cohortSet.add(cohort);
      grouped[cohort] = (grouped[cohort] || 0) + 1;
    }

    const labels = Array.from(cohortSet).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, "th");
    });

    const data = labels.map((label) => grouped[label] || 0);

    return NextResponse.json({ labels, data });
  } catch (error) {
    console.error("Failed to fetch alumni count:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni count data" },
      { status: 500 }
    );
  }
}

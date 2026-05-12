import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const alumni = await prisma.alumni.findMany({
      select: {
        initialYear: true,
        degreeLevel: true,
      },
    });

    const yearSet = new Set<number>();
    const grouped: Record<string, Record<number, number>> = {};

    for (const a of alumni) {
      yearSet.add(a.initialYear);
      if (!grouped[a.degreeLevel]) {
        grouped[a.degreeLevel] = {};
      }
      grouped[a.degreeLevel][a.initialYear] =
        (grouped[a.degreeLevel][a.initialYear] || 0) + 1;
    }

    const labels = Array.from(yearSet).sort((a, b) => a - b);
    const degreeLevels = ["DOCTORAL", "MASTER", "BACHELOR", "NURSING_CERTIFICATE"];

    const datasets = degreeLevels
      .filter((dl) => grouped[dl])
      .map((dl) => ({
        degreeLevel: dl,
        data: labels.map((year) => grouped[dl][year] || 0),
      }));

    return NextResponse.json({ labels, datasets });
  } catch (error) {
    console.error("Failed to fetch alumni count:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni count data" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { cohort: { contains: search, mode: "insensitive" } },
      ];
    }

    const alumni = await prisma.modelRepresentative.findMany({
      where,
      orderBy: [{ cohort: "asc" }, { generation: "asc" }],
    });

    return NextResponse.json({ data: alumni });
  } catch (error) {
    console.error("Failed to fetch model representatives:", error);
    return NextResponse.json(
      { error: "Failed to fetch model representatives" },
      { status: 500 }
    );
  }
}

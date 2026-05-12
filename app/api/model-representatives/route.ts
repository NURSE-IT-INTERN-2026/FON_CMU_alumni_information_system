import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const search = searchParams.get("search") || "";
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);

    const where: Record<string, unknown> = {
      isModelRepresentative: true,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { achievementSummary: { contains: search, mode: "insensitive" } },
      ];
    }

    const [alumni, total] = await Promise.all([
      prisma.alumni.findMany({
        where,
        orderBy: { graduationYear: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.alumni.count({ where }),
    ]);

    return NextResponse.json({
      data: alumni,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch model representatives:", error);
    return NextResponse.json(
      { error: "Failed to fetch model representatives" },
      { status: 500 }
    );
  }
}

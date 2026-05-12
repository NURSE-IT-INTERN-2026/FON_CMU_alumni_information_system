import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const search = searchParams.get("search") || "";
    const country = searchParams.get("country") || "";
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);

    const where: Record<string, unknown> = {
      country: { not: null },
    };

    if (country) {
      where.country = country;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
        { currentWorkplace: { contains: search, mode: "insensitive" } },
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

    const countries = await prisma.alumni.findMany({
      where: { country: { not: null } },
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
    });

    return NextResponse.json({
      data: alumni,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      countries: countries.map((c) => c.country).filter(Boolean),
    });
  } catch (error) {
    console.error("Failed to fetch abroad alumni:", error);
    return NextResponse.json(
      { error: "Failed to fetch abroad alumni" },
      { status: 500 }
    );
  }
}

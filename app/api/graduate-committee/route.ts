import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const search = searchParams.get("search") || "";
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { role: { contains: search, mode: "insensitive" } },
        {
          alumni: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [committees, total] = await Promise.all([
      prisma.graduateCommittee.findMany({
        where,
        include: {
          alumni: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { termYear: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.graduateCommittee.count({ where }),
    ]);

    return NextResponse.json({
      data: committees,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch graduate committees:", error);
    return NextResponse.json(
      { error: "Failed to fetch graduate committees" },
      { status: 500 }
    );
  }
}

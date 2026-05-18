import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, awardName, awardType, year, description } = body;

    if (!studentId || !awardName || !awardType || !year) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const award = await prisma.award.create({
      data: {
        studentId,
        awardName: awardName.trim(),
        awardType,
        year: Number(year),
        description: description?.trim() || null,
      },
      include: {
        alumni: { select: { prefix: true, firstName: true, maidenLastName: true } },
      },
    });

    return NextResponse.json(award, { status: 201 });
  } catch (error) {
    console.error("Failed to create award:", error);
    return NextResponse.json(
      { error: "Failed to create award" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const search = searchParams.get("search") || "";
    const awardType = searchParams.get("awardType") || "";
    const pageSize = parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10);

    const where: Record<string, unknown> = {};

    if (awardType) {
      where.awardType = awardType;
    }

    if (search) {
      where.OR = [
        { awardName: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        {
          alumni: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { maidenLastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [awards, total] = await Promise.all([
      prisma.award.findMany({
        where,
        include: {
          alumni: {
            select: {
              prefix: true,
              firstName: true,
              maidenLastName: true,
            },
          },
        },
        orderBy: { year: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.award.count({ where }),
    ]);

    return NextResponse.json({
      data: awards,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Failed to fetch awards:", error);
    return NextResponse.json(
      { error: "Failed to fetch awards" },
      { status: 500 }
    );
  }
}

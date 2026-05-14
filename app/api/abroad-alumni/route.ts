import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const country = searchParams.get("country") || "";

    const where: Record<string, unknown> = {};

    if (country) {
      where.country = country;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { university: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }

    const [alumni, countries] = await Promise.all([
      prisma.abroadAlumni.findMany({
        where,
        orderBy: [{ country: "asc" }, { university: "asc" }, { order: "asc" }],
      }),
      prisma.abroadAlumni.findMany({
        select: { country: true },
        distinct: ["country"],
        orderBy: { country: "asc" },
      }),
    ]);

    return NextResponse.json({
      data: alumni,
      countries: countries.map((c) => c.country),
    });
  } catch (error) {
    console.error("Failed to fetch abroad alumni:", error);
    return NextResponse.json(
      { error: "Failed to fetch abroad alumni" },
      { status: 500 }
    );
  }
}

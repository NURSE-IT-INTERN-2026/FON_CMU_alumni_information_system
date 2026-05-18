import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, address, country, university, order } = body;

    if (!name || !country) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const item = await prisma.abroadAlumni.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
        country: country.trim(),
        university: university?.trim() || null,
        order: order !== undefined ? Number(order) : 0,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create abroad alumni:", error);
    return NextResponse.json(
      { error: "Failed to create abroad alumni" },
      { status: 500 }
    );
  }
}

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

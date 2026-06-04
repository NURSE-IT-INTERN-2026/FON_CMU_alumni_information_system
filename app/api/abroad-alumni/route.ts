import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const { cohort, prefix, thaiName, englishName, workplace, country, notes, order } = body;

    if (!country) {
      return NextResponse.json(
        { error: "กรุณากรอกประเทศ" },
        { status: 400 }
      );
    }

    if (!thaiName && !englishName) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อไทยหรือชื่ออังกฤษ" },
        { status: 400 }
      );
    }

    const item = await prisma.abroadAlumni.create({
      data: {
        cohort: cohort?.trim() || null,
        prefix: prefix?.trim() || null,
        thaiName: thaiName?.trim() || null,
        englishName: englishName?.trim() || null,
        workplace: workplace?.trim() || null,
        country: country.trim(),
        notes: notes?.trim() || null,
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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const country = searchParams.get("country") || "";
    const searchFieldParam = searchParams.get("searchField") || "all";

    const validSearchFields = ["thaiName", "englishName", "country", "workplace", "cohort"];

    const where: Record<string, unknown> = {};

    if (country) {
      where.country = country;
    }

    if (search) {
      if (searchFieldParam && validSearchFields.includes(searchFieldParam)) {
        where[searchFieldParam] = { contains: search, mode: "insensitive" };
      } else {
        where.OR = [
          { thaiName: { contains: search, mode: "insensitive" } },
          { englishName: { contains: search, mode: "insensitive" } },
          { workplace: { contains: search, mode: "insensitive" } },
          { country: { contains: search, mode: "insensitive" } },
          { cohort: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const [alumni, countries] = await Promise.all([
      prisma.abroadAlumni.findMany({
        where,
        orderBy: [{ country: "asc" }, { order: "asc" }],
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

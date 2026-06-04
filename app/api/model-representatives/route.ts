import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const { studentId, name, cohort, generation } = body;

    if (!studentId || !name || !cohort || generation === undefined) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const item = await prisma.modelRepresentative.create({
      data: {
        studentId: studentId.trim(),
        name: name.trim(),
        cohort: cohort.trim(),
        generation: Number(generation),
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create model representative:", error);
    return NextResponse.json(
      { error: "Failed to create model representative" },
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

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { studentId: { contains: search, mode: "insensitive" } },
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

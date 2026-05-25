import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const item = await prisma.abroadAlumni.update({
      where: { id },
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

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update abroad alumni:", error);
    return NextResponse.json(
      { error: "Failed to update abroad alumni" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.abroadAlumni.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete abroad alumni:", error);
    return NextResponse.json(
      { error: "Failed to delete abroad alumni" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { studentId, awardName, awardType, year, description } = body;

    if (!studentId || !awardName || !awardType || !year) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const award = await prisma.award.update({
      where: { id },
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

    return NextResponse.json(award);
  } catch (error) {
    console.error("Failed to update award:", error);
    return NextResponse.json(
      { error: "Failed to update award" },
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
    await prisma.award.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete award:", error);
    return NextResponse.json(
      { error: "Failed to delete award" },
      { status: 500 }
    );
  }
}

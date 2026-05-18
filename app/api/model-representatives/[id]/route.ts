import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { studentId, name, cohort, generation } = body;

    if (!studentId || !name || !cohort || generation === undefined) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const item = await prisma.modelRepresentative.update({
      where: { id },
      data: {
        studentId: studentId.trim(),
        name: name.trim(),
        cohort: cohort.trim(),
        generation: Number(generation),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update model representative:", error);
    return NextResponse.json(
      { error: "Failed to update model representative" },
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
    await prisma.modelRepresentative.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete model representative:", error);
    return NextResponse.json(
      { error: "Failed to delete model representative" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { studentId, fullName, career, position, recordedYear } = body;

    if (!studentId || !fullName || !career || !position || !recordedYear) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const potential = await prisma.potential.update({
      where: { id },
      data: {
        studentId: studentId.trim(),
        fullName: fullName.trim(),
        career: career.trim(),
        position: position.trim(),
        recordedYear: Number(recordedYear),
      },
    });

    return NextResponse.json(potential);
  } catch (error) {
    console.error("Failed to update potential:", error);
    return NextResponse.json(
      { error: "Failed to update potential" },
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
    await prisma.potential.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete potential:", error);
    return NextResponse.json(
      { error: "Failed to delete potential" },
      { status: 500 }
    );
  }
}

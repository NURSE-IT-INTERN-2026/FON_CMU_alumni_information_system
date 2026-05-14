import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { studentId, fullName, associationName, position, recordedYear } = body;

    if (!studentId || !fullName || !associationName || !position || !recordedYear) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const item = await prisma.association.update({
      where: { id },
      data: {
        studentId: studentId.trim(),
        fullName: fullName.trim(),
        associationName: associationName.trim(),
        position: position.trim(),
        recordedYear: Number(recordedYear),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update association:", error);
    return NextResponse.json(
      { error: "Failed to update association" },
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
    await prisma.association.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete association:", error);
    return NextResponse.json(
      { error: "Failed to delete association" },
      { status: 500 }
    );
  }
}

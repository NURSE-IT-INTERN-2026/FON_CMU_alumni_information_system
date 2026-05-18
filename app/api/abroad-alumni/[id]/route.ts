import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { studentId, name, address, country, university, order } = body;

    if (!studentId || !name || !country) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const item = await prisma.abroadAlumni.update({
      where: { id },
      data: {
        studentId: studentId.trim(),
        name: name.trim(),
        address: address?.trim() || null,
        country: country.trim(),
        university: university?.trim() || null,
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

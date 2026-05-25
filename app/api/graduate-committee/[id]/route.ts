import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;
    const body = await request.json();
    const { termYear, studentId, fullName, cohort, position, remarks } = body;

    if (!termYear || !studentId || !fullName || !cohort || !position) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const committee = await prisma.graduateCommittee.update({
      where: { id },
      data: {
        termYear: Number(termYear),
        studentId: studentId.trim(),
        fullName: fullName.trim(),
        cohort: cohort.trim(),
        position: position.trim(),
        remarks: remarks?.trim() || null,
      },
    });

    return NextResponse.json(committee);
  } catch (error) {
    console.error("Failed to update graduate committee:", error);
    return NextResponse.json(
      { error: "Failed to update graduate committee" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;
    await prisma.graduateCommittee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete graduate committee:", error);
    return NextResponse.json(
      { error: "Failed to delete graduate committee" },
      { status: 500 }
    );
  }
}

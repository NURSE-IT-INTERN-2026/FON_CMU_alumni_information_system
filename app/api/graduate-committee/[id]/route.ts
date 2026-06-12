import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { handleZodError, committeeUpdateSchema } from "@/lib/validations";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = committeeUpdateSchema.parse(body);

    const committee = await prisma.graduateCommittee.update({
      where: { id },
      data: {
        termYear: Number(validated.termYear),
        studentId: validated.studentId!.trim(),
        fullName: validated.fullName!.trim(),
        cohort: validated.cohort!.trim(),
        position: validated.position!.trim(),
        remarks: validated.remarks?.trim() || null,
      },
    });

    return NextResponse.json(committee);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { handleZodError, potentialUpdateSchema } from "@/lib/validations";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = potentialUpdateSchema.parse(body);

    const potential = await prisma.potential.update({
      where: { id },
      data: {
        studentId: validated.studentId!.trim(),
        fullName: validated.fullName!.trim(),
        career: validated.career!.trim(),
        position: validated.position!.trim(),
        recordedYear: Number(validated.recordedYear),
      },
    });

    return NextResponse.json(potential);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
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
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
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

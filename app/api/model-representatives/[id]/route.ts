import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { handleZodError, modelRepUpdateSchema } from "@/lib/validations";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = modelRepUpdateSchema.parse(body);

    const item = await prisma.modelRepresentative.update({
      where: { id },
      data: {
        studentId: validated.studentId!.trim(),
        name: validated.name!.trim(),
        cohort: validated.cohort!.trim(),
        generation: Number(validated.generation),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
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
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { handleZodError, associationUpdateSchema } from "@/lib/validations";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = associationUpdateSchema.parse(body);

    const item = await prisma.association.update({
      where: { id },
      data: {
        studentId: validated.studentId!.trim(),
        fullName: validated.fullName!.trim(),
        associationName: validated.associationName!.trim(),
        position: validated.position!.trim(),
        recordedYear: Number(validated.recordedYear),
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
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
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
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

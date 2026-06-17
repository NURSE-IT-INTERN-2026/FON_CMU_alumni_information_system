import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { handleZodError, abroadAlumniUpdateSchema } from "@/lib/validations";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = abroadAlumniUpdateSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validated.cohort !== undefined) updateData.cohort = validated.cohort?.trim() || null;
    if (validated.prefix !== undefined) updateData.prefix = validated.prefix?.trim() || null;
    if (validated.thaiName !== undefined) updateData.thaiName = validated.thaiName?.trim() || null;
    if (validated.englishName !== undefined) updateData.englishName = validated.englishName?.trim() || null;
    if (validated.workplace !== undefined) updateData.workplace = validated.workplace?.trim() || null;
    if (validated.homeAddress !== undefined) updateData.homeAddress = validated.homeAddress?.trim() || null;
    if (validated.country !== undefined) updateData.country = validated.country;
    if (validated.notes !== undefined) updateData.notes = validated.notes?.trim() || null;
    if (validated.order !== undefined) updateData.order = validated.order;

    const item = await prisma.abroadAlumni.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
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
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";
import { handleZodError, modelRepUpdateSchema } from "@/lib/validations";
import { TRACKED_FIELDS, computeFieldChanges, recordFieldChanges } from "@/lib/field-changes";

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

    const old = await prisma.modelRepresentative.findUnique({ where: { id } });

    const item = await prisma.modelRepresentative.update({
      where: { id },
      data: {
        studentId: validated.studentId!.trim(),
        prefix: validated.prefix?.trim() || null,
        firstName: validated.firstName!.trim(),
        lastName: validated.lastName!.trim(),
        cohort: validated.cohort!.trim(),
        generation: Number(validated.generation),
        major: validated.major?.trim() || null,
      },
    });

    const changes = computeFieldChanges(old, item, TRACKED_FIELDS.model_representative);
    const session = await getSession();
    if (session) {
      await recordFieldChanges({ resourceType: "model_representative", resourceId: id, changes, actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email }, reason: validated.reason });
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "model_representative",
        id,
        { changes },
        getIp(request),
        validated.reason
      );
    }

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
    await prisma.modelRepresentative.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete model representative:", error);
    return NextResponse.json(
      { error: "Failed to delete model representative" },
      { status: 500 }
    );
  }
}

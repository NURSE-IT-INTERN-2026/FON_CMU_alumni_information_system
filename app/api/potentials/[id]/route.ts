import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";
import { handleZodError, potentialUpdateSchema } from "@/lib/validations";
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
    const validated = potentialUpdateSchema.parse(body);

    const old = await prisma.potential.findUnique({ where: { id } });

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

    const changes = computeFieldChanges(old, potential, TRACKED_FIELDS.potential);
    const session = await getSession();
    if (session) {
      await recordFieldChanges({ resourceType: "potential", resourceId: id, changes, actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email }, reason: validated.reason });
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "potential",
        id,
        { changes },
        getIp(request),
        validated.reason
      );
    }

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
    await prisma.potential.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete potential:", error);
    return NextResponse.json(
      { error: "Failed to delete potential" },
      { status: 500 }
    );
  }
}

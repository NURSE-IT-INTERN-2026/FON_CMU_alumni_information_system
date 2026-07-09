import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
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
        studentId: validated.studentId?.trim() || null,
        ...(validated.studentId?.trim() ? { pendingStudentId: null } : {}),
        prefix: validated.prefix?.trim() || null,
        firstName: validated.firstName!.trim(),
        lastName: validated.lastName!.trim(),
        career: validated.career!.trim(),
        position: validated.position!.trim(),
        recordedYear: Number(validated.recordedYear),
        major: validated.major?.trim() || null,
      },
    });

    const changes = computeFieldChanges(old, potential, TRACKED_FIELDS.potential);
    const session = await getSession();
    if (session) {
      const logId = await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "potential",
        id,
        { changes },
        validated.reason
      );
      await recordFieldChanges({ resourceType: "potential", resourceId: id, changes, actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email }, reason: validated.reason, activityLogId: logId });
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
    const existing = await prisma.potential.findUnique({ where: { id } });
    await prisma.potential.update({ where: { id }, data: { deletedAt: new Date() } });

    const session = await getSession();
    if (session && existing) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "DELETE",
        "potential",
        id,
        {
          career: existing.career,
          position: existing.position,
          recordedYear: existing.recordedYear,
          name: `${existing.prefix ?? ""}${existing.firstName} ${existing.lastName}`.trim(),
        },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete potential:", error);
    return NextResponse.json(
      { error: "Failed to delete potential" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, committeeUpdateSchema } from "@/lib/validations";
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
    const validated = committeeUpdateSchema.parse(body);

    const old = await prisma.graduateCommittee.findUnique({ where: { id } });

    const committee = await prisma.graduateCommittee.update({
      where: { id },
      data: {
        termYear: Number(validated.termYear),
        studentId: validated.studentId!.trim(),
        prefix: validated.prefix?.trim() || null,
        firstName: validated.firstName!.trim(),
        lastName: validated.lastName!.trim(),
        cohort: validated.cohort!.trim(),
        position: validated.position!.trim(),
        remarks: validated.remarks?.trim() || null,
        major: validated.major?.trim() || null,
      },
    });

    const changes = computeFieldChanges(old, committee, TRACKED_FIELDS.graduate_committee);
    const session = await getSession();
    if (session) {
      await recordFieldChanges({ resourceType: "graduate_committee", resourceId: id, changes, actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email }, reason: validated.reason });
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "graduate_committee",
        id,
        { changes },
        validated.reason
      );
    }

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
    await prisma.graduateCommittee.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete graduate committee:", error);
    return NextResponse.json(
      { error: "Failed to delete graduate committee" },
      { status: 500 }
    );
  }
}

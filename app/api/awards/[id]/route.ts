import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";
import { handleZodError, awardUpdateSchema } from "@/lib/validations";
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
    const validated = awardUpdateSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validated.studentId !== undefined) updateData.studentId = validated.studentId || null;
    if (validated.recipientName !== undefined) updateData.recipientName = validated.recipientName?.trim() || null;
    if (validated.awardName !== undefined) updateData.awardName = validated.awardName;
    if (validated.awardType !== undefined) updateData.awardType = validated.awardType;
    if (validated.year !== undefined) updateData.year = validated.year;
    if (validated.description !== undefined) updateData.description = validated.description?.trim() || null;
    if (validated.major !== undefined) updateData.major = validated.major?.trim() || null;

    const old = await prisma.award.findUnique({ where: { id } });

    const award = await prisma.award.update({
      where: { id },
      data: updateData,
      include: {
        alumni: { select: { prefix: true, firstName: true, maidenLastName: true } },
      },
    });

    const changes = computeFieldChanges(old, award, TRACKED_FIELDS.award);
    const session = await getSession();
    if (session) {
      await recordFieldChanges({
        resourceType: "award",
        resourceId: id,
        changes,
        actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email },
        reason: validated.reason,
      });
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "award",
        id,
        { changes },
        getIp(request),
        validated.reason
      );
    }

    return NextResponse.json(award);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("Failed to update award:", error);
    return NextResponse.json(
      { error: "Failed to update award" },
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
    await prisma.award.update({ where: { id }, data: { deletedAt: new Date() } });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "DELETE",
        "award",
        id,
        null,
        getIp(request)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete award:", error);
    return NextResponse.json(
      { error: "Failed to delete award" },
      { status: 500 }
    );
  }
}

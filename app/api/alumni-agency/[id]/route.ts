import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, alumniAgencyUpdateSchema } from "@/lib/validations";
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
    const validated = alumniAgencyUpdateSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validated.cohort !== undefined) updateData.cohort = validated.cohort?.trim() || null;
    if (validated.prefix !== undefined) updateData.prefix = validated.prefix?.trim() || null;
    if (validated.firstName !== undefined) updateData.firstName = validated.firstName?.trim() || null;
    if (validated.lastName !== undefined) updateData.lastName = validated.lastName?.trim() || null;
    if (validated.englishName !== undefined) updateData.englishName = validated.englishName?.trim() || null;
    if (validated.workplace !== undefined) updateData.workplace = validated.workplace?.trim() || null;
    if (validated.homeAddress !== undefined) updateData.homeAddress = validated.homeAddress?.trim() || null;
    if (validated.country !== undefined) updateData.country = validated.country;
    if (validated.notes !== undefined) updateData.notes = validated.notes?.trim() || null;
    if (validated.order !== undefined) updateData.order = validated.order;
    if (validated.major !== undefined) updateData.major = validated.major?.trim() || null;
    if (validated.studentId !== undefined) {
      updateData.studentId = validated.studentId?.trim() || null;
      // Linking a real alumni supersedes any pending flag (the manual form only
      // ever picks existing alumni via useAlumniSearch, so a non-empty id is a
      // real link). pendingStudentId is otherwise never written from the form.
      if (validated.studentId && validated.studentId.trim()) updateData.pendingStudentId = null;
    }

    const old = await prisma.alumniAgency.findUnique({ where: { id } });

    const item = await prisma.alumniAgency.update({
      where: { id },
      data: updateData,
    });

    const changes = computeFieldChanges(old, item, TRACKED_FIELDS.alumni_agency);
    const session = await getSession();
    if (session) {
      await recordFieldChanges({ resourceType: "alumni_agency", resourceId: id, changes, actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email }, reason: validated.reason });
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "alumni_agency",
        id,
        { changes },
        validated.reason
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("Failed to update alumni agency:", error);
    return NextResponse.json(
      { error: "Failed to update alumni agency" },
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
    const existing = await prisma.alumniAgency.findUnique({ where: { id } });
    await prisma.alumniAgency.update({ where: { id }, data: { deletedAt: new Date() } });

    const session = await getSession();
    if (session && existing) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "DELETE",
        "alumni_agency",
        id,
        {
          workplace: existing.workplace,
          cohort: existing.cohort,
          major: existing.major,
          name: `${existing.prefix ?? ""}${existing.firstName ?? ""} ${existing.lastName ?? ""}`.trim(),
        },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete alumni agency:", error);
    return NextResponse.json(
      { error: "Failed to delete alumni agency" },
      { status: 500 }
    );
  }
}

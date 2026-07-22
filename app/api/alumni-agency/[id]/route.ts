import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, alumniAgencyUpdateSchema } from "@/lib/validations";
import { TRACKED_FIELDS, computeFieldChanges, recordFieldChanges } from "@/lib/field-changes";
import { syncAgencyHomeAddressToAlumni } from "@/lib/alumni-agency-home-sync";

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

    const old = await prisma.alumniAgency.findUnique({ where: { id } });

    // Detect a MANUAL link event: admin typed a real studentId into a row that
    // was previously pending (pendingStudentId set). On that event we match the
    // auto-link semantics — the alumni's canonical name wins (overwrite the
    // row's prefix/firstName/lastName). Plain edits to already-linked rows keep
    // the form's name values. (homeAddress already flows agency→alumni via the
    // syncAgencyHomeAddressToAlumni call below.)
    const linkingStudentId = validated.studentId?.trim() || null;
    const isManualLink = !!linkingStudentId && !!old?.pendingStudentId;
    let linkedName: { prefix: string | null; firstName: string; lastName: string } | null = null;
    if (isManualLink) {
      const linked = await prisma.alumni.findUnique({
        where: { studentId: linkingStudentId },
        select: { prefix: true, firstName: true, lastName: true },
      });
      if (linked) linkedName = linked;
    }

    const updateData: Record<string, unknown> = {};
    if (validated.cohort !== undefined) updateData.cohort = validated.cohort?.trim() || null;
    if (validated.prefix !== undefined) updateData.prefix = validated.prefix?.trim() || null;
    if (validated.firstName !== undefined) updateData.firstName = validated.firstName?.trim() || null;
    if (validated.lastName !== undefined) updateData.lastName = validated.lastName?.trim() || null;
    if (validated.englishName !== undefined) updateData.englishName = validated.englishName?.trim() || null;
    if (validated.workplace !== undefined) updateData.workplace = validated.workplace?.trim() || null;
    if (validated.province !== undefined) updateData.province = validated.province?.trim() || null;
    if (validated.position !== undefined) updateData.position = validated.position?.trim() || null;
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
    // Manual link → alumni's name wins (matches auto-link).
    if (linkedName) {
      updateData.prefix = linkedName.prefix;
      updateData.firstName = linkedName.firstName;
      updateData.lastName = linkedName.lastName;
    }

    const item = await prisma.alumniAgency.update({
      where: { id },
      data: updateData,
    });

    const changes = computeFieldChanges(old, item, TRACKED_FIELDS.alumni_agency);
    const session = await getSession();
    if (session) {
      const ctx = { actorType: "ADMIN" as const, userId: session.user.id, userEmail: session.user.email, userRole: session.user.role };
      const logId = await logActivity(
        ctx,
        "UPDATE",
        "alumni_agency",
        id,
        { changes },
        validated.reason
      );
      await recordFieldChanges({ resourceType: "alumni_agency", resourceId: id, changes, actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email }, reason: validated.reason, activityLogId: logId });
      // Sync the agency ที่อยู่บ้าน onto the linked Alumni's ที่อยู่ปัจจุบัน (the
      // all-alumni table reads Alumni.homeAddress). Uses the post-update
      // studentId/homeAddress so a fresh link to an already-addressed row still
      // propagates, while an unchanged homeAddress is a no-op.
      await syncAgencyHomeAddressToAlumni({ ctx, studentId: item.studentId, agencyHomeAddress: item.homeAddress, reason: validated.reason });
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

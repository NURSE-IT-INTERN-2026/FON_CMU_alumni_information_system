import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { AwardType, DegreeLevel } from "@/app/generated/prisma/client";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";
import { handleZodError, alumniWithRelatedUpdateSchema } from "@/lib/validations";
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
    const validated = alumniWithRelatedUpdateSchema.parse(body);

    const existing = await prisma.alumni.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    const hasPotentials = (validated.potentials?.length ?? 0) > 0;
    const hasModelReps =
      (validated.modelRepresentatives?.length ?? 0) > 0;

    const fullName = `${validated.prefix}${validated.firstName} ${validated.maidenLastName}`;

    const alumni = await prisma.$transaction(async (tx) => {
      // Update core alumni fields
      const updated = await tx.alumni.update({
        where: { id },
        data: {
          prefix: validated.prefix,
          firstName: validated.firstName,
          maidenLastName: validated.maidenLastName,
          cohort: validated.cohort || null,
          degreeLevel: (validated.degreeLevel as DegreeLevel) || null,
          newLastName: validated.newLastName || null,
          province: validated.province || null,
          email: validated.email || null,
          phone: validated.phone || null,
          currentWorkplace: validated.currentWorkplace || null,
          country: validated.country || null,
          isPotential: hasPotentials,
          isModelRepresentative: hasModelReps,
          // Admin edit — flag so the alumni sees the "edited by admin" popup
          // on next login (PRD §3.15 / §3.1.4).
          adminEditedAt: new Date(),
        },
      });

      // --- Replace all related data ---

      // Awards: delete old, create new
      await tx.award.deleteMany({ where: { studentId: existing.studentId } });
      if (validated.awards && validated.awards.length > 0) {
        await tx.award.createMany({
          data: validated.awards.map((a) => ({
            studentId: existing.studentId,
            prefix: validated.prefix,
            firstName: validated.firstName,
            lastName: validated.maidenLastName,
            awardName: a.awardName,
            awardType: a.awardType as AwardType,
            year: a.year,
            description: a.description || null,
          })),
        });
      }

      // Associations
      await tx.association.deleteMany({
        where: { studentId: existing.studentId },
      });
      if (validated.associations && validated.associations.length > 0) {
        await tx.association.createMany({
          data: validated.associations.map((a) => ({
            studentId: existing.studentId,
            fullName,
            associationName: a.associationName,
            position: a.position,
            recordedYear: a.recordedYear,
          })),
        });
      }

      // Graduate committees
      await tx.graduateCommittee.deleteMany({
        where: { studentId: existing.studentId },
      });
      if (validated.graduateCommittees && validated.graduateCommittees.length > 0) {
        await tx.graduateCommittee.createMany({
          data: validated.graduateCommittees.map((g) => ({
            studentId: existing.studentId,
            termYear: g.termYear,
            fullName,
            cohort: g.cohort,
            position: g.position,
            remarks: g.remarks || null,
          })),
        });
      }

      // Potentials
      await tx.potential.deleteMany({
        where: { studentId: existing.studentId },
      });
      if (hasPotentials) {
        await tx.potential.createMany({
          data: validated.potentials!.map((p) => ({
            studentId: existing.studentId,
            fullName,
            career: p.career,
            position: p.position,
            recordedYear: p.recordedYear,
          })),
        });
      }

      // Model representatives
      await tx.modelRepresentative.deleteMany({
        where: { studentId: existing.studentId },
      });
      if (hasModelReps) {
        await tx.modelRepresentative.createMany({
          data: validated.modelRepresentatives!.map((m) => ({
            studentId: existing.studentId,
            name: fullName,
            cohort: m.cohort,
            generation: m.generation,
          })),
        });
      }

      return updated;
    });

    // Log activity + field-change history
    const changes = computeFieldChanges(existing, alumni, TRACKED_FIELDS.alumni);
    const session = await getSession();
    if (session) {
      await recordFieldChanges({ resourceType: "alumni", resourceId: id, changes, actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email }, reason: validated.reason });
      await logActivity(
        {
          actorType: "ADMIN",
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: session.user.role,
        },
        "UPDATE",
        "alumni",
        id,
        { changes, source: "update-with-related" },
        getIp(request),
        validated.reason
      );
    }

    return NextResponse.json(alumni);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/alumni/update-with-related/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

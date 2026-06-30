import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { AwardType } from "@/app/generated/prisma/client";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, alumniWithRelatedCreateSchema } from "@/lib/validations";
import { ensurePrimaryEducationFromSnapshot } from "@/lib/education-sync";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const validated = alumniWithRelatedCreateSchema.parse(body);

    // Business logic: check for duplicate studentId
    const existing = await prisma.alumni.findUnique({
      where: { studentId: validated.studentId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" },
        { status: 409 }
      );
    }

    const hasPotentials = (validated.potentials?.length ?? 0) > 0;
    const hasModelReps =
      (validated.modelRepresentatives?.length ?? 0) > 0;

    const alumni = await prisma.$transaction(async (tx) => {
      const created = await tx.alumni.create({
        data: {
          studentId: validated.studentId,
          prefix: validated.prefix,
          firstName: validated.firstName,
          lastName: validated.lastName,
          cohort: validated.cohort || null,
          graduationYear: validated.graduationYear ?? null,
          degreeLevel: validated.degreeLevel || "BACHELOR",
          email: validated.email || null,
          contactEmail: validated.contactEmail || null,
          phones: validated.phones ?? [],
          homeAddress: validated.homeAddress?.trim() || null,
          birthDate: validated.birthDate || null,
          photoUrl: validated.photoUrl || null,
          isPotential: hasPotentials,
          isModelRepresentative: hasModelReps,
        },
      });
      // Give the new alumni a primary Education row mirroring its snapshot.
      await ensurePrimaryEducationFromSnapshot(created.id, tx);

      if (validated.awards && validated.awards.length > 0) {
        await tx.award.createMany({
          data: validated.awards.map((a) => ({
            studentId: validated.studentId,
            prefix: validated.prefix,
            firstName: validated.firstName,
            lastName: validated.lastName,
            awardName: a.awardName,
            awardType: a.awardType as AwardType,
            year: a.year,
            description: a.description || null,
          })),
        });
      }

      if (validated.associations && validated.associations.length > 0) {
        await tx.association.createMany({
          data: validated.associations.map((a) => ({
            studentId: validated.studentId,
            prefix: validated.prefix,
            firstName: validated.firstName,
            lastName: validated.lastName,
            associationName: a.associationName,
            position: a.position,
            recordedYear: a.recordedYear,
          })),
        });
      }

      if (validated.graduateCommittees && validated.graduateCommittees.length > 0) {
        await tx.graduateCommittee.createMany({
          data: validated.graduateCommittees.map((g) => ({
            studentId: validated.studentId,
            termYear: g.termYear,
            prefix: validated.prefix,
            firstName: validated.firstName,
            lastName: validated.lastName,
            cohort: g.cohort,
            position: g.position,
            remarks: g.remarks || null,
          })),
        });
      }

      if (hasPotentials) {
        await tx.potential.createMany({
          data: validated.potentials!.map((p) => ({
            studentId: validated.studentId,
            prefix: validated.prefix,
            firstName: validated.firstName,
            lastName: validated.lastName,
            career: p.career,
            position: p.position,
            recordedYear: p.recordedYear,
          })),
        });
      }

      if (hasModelReps) {
        await tx.modelRepresentative.createMany({
          data: validated.modelRepresentatives!.map((m) => ({
            studentId: validated.studentId,
            prefix: validated.prefix,
            firstName: validated.firstName,
            lastName: validated.lastName,
            cohort: m.cohort,
            generation: m.generation,
          })),
        });
      }

      if (validated.alumniAgency && validated.alumniAgency.length > 0) {
        await tx.alumniAgency.createMany({
          data: validated.alumniAgency.map((a, idx) => ({
            // Link to the alumni being created; identity is auto-filled from
            // the record (the form only collects the alumni-owned fields).
            studentId: validated.studentId,
            prefix: validated.prefix,
            firstName: validated.firstName,
            lastName: validated.lastName,
            cohort: validated.cohort || null,
            workplace: a.workplace || null,
            homeAddress: a.homeAddress || null,
            country: a.country,
            notes: a.notes || null,
            order: idx, // column has no DB default
          })),
        });
      }

      return created;
    });

    // Log the alumni CREATE (best-effort — logActivity swallows its own errors).
    // This full-form route is what the new-alumni page posts to; without this
    // call, creating an alumni via the form left no activity-log entry (the
    // single POST /api/alumni route logs, but this one didn't).
    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "CREATE",
        "alumni",
        alumni.id,
        { studentId: alumni.studentId, name: `${alumni.prefix}${alumni.firstName} ${alumni.lastName}` },
      );
    }

    return NextResponse.json(alumni, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/alumni/create-with-related error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

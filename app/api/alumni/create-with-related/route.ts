import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { AwardType } from "@/app/generated/prisma/client";
import { checkWritePermission } from "@/lib/permissions";
import { handleZodError, alumniWithRelatedCreateSchema } from "@/lib/validations";

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
          maidenLastName: validated.maidenLastName,
          cohort: validated.cohort || null,
          degreeLevel: validated.degreeLevel || "BACHELOR",
          newLastName: validated.newLastName || null,
          province: validated.province || null,
          email: validated.email || null,
          phone: validated.phone || null,
          currentWorkplace: validated.currentWorkplace || null,
          country: validated.country || null,
          photoUrl: validated.photoUrl || null,
          isPotential: hasPotentials,
          isModelRepresentative: hasModelReps,
        },
      });

      if (validated.awards && validated.awards.length > 0) {
        await tx.award.createMany({
          data: validated.awards.map((a) => ({
            studentId: validated.studentId,
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
            fullName:
              a.fullName ||
              `${validated.prefix}${validated.firstName} ${validated.maidenLastName}`,
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
            fullName:
              g.fullName ||
              `${validated.prefix}${validated.firstName} ${validated.maidenLastName}`,
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
            fullName:
              p.fullName ||
              `${validated.prefix}${validated.firstName} ${validated.maidenLastName}`,
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
            name:
              m.name ||
              `${validated.prefix}${validated.firstName} ${validated.maidenLastName}`,
            cohort: m.cohort,
            generation: m.generation,
          })),
        });
      }

      if (validated.abroadAlumni && validated.abroadAlumni.length > 0) {
        await tx.abroadAlumni.createMany({
          data: validated.abroadAlumni.map((a) => ({
            cohort: a.cohort || null,
            prefix: a.prefix || null,
            thaiName: a.thaiName || null,
            englishName: a.englishName || null,
            workplace: a.workplace || null,
            country: a.country,
            notes: a.notes || null,
            order: a.order,
          })),
        });
      }

      return created;
    });

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

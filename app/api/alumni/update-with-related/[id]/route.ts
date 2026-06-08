import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AwardType } from "@/app/generated/prisma/client";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;

  try {
    const { id } = await params;
    const body = await request.json();

    const {
      prefix,
      firstName,
      maidenLastName,
      cohort,
      degreeLevel,
      newLastName,
      province,
      email,
      phone,
      currentWorkplace,
      country,
      awards,
      associations,
      graduateCommittees,
      potentials,
      modelRepresentatives,
    } = body;

    if (!prefix || !firstName || !maidenLastName) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const existing = await prisma.alumni.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    const hasPotentials = Array.isArray(potentials) && potentials.length > 0;
    const hasModelReps =
      Array.isArray(modelRepresentatives) && modelRepresentatives.length > 0;

    const fullName = `${prefix}${firstName} ${maidenLastName}`;

    const alumni = await prisma.$transaction(async (tx) => {
      // Update core alumni fields
      const updated = await tx.alumni.update({
        where: { id },
        data: {
          prefix,
          firstName,
          maidenLastName,
          cohort: cohort || null,
          degreeLevel: degreeLevel || null,
          newLastName: newLastName || null,
          province: province || null,
          email: email || null,
          phone: phone || null,
          currentWorkplace: currentWorkplace || null,
          country: country || null,
          isPotential: hasPotentials,
          isModelRepresentative: hasModelReps,
        },
      });

      // --- Replace all related data ---

      // Awards: delete old, create new
      await tx.award.deleteMany({ where: { studentId: existing.studentId } });
      if (Array.isArray(awards) && awards.length > 0) {
        await tx.award.createMany({
          data: awards.map(
            (a: {
              awardName: string;
              awardType: string;
              year: number;
              description?: string;
            }) => ({
              studentId: existing.studentId,
              awardName: a.awardName,
              awardType: a.awardType as AwardType,
              year: Number(a.year),
              description: a.description || null,
            })
          ),
        });
      }

      // Associations
      await tx.association.deleteMany({
        where: { studentId: existing.studentId },
      });
      if (Array.isArray(associations) && associations.length > 0) {
        await tx.association.createMany({
          data: associations.map(
            (a: {
              associationName: string;
              position: string;
              recordedYear: number;
            }) => ({
              studentId: existing.studentId,
              fullName,
              associationName: a.associationName,
              position: a.position,
              recordedYear: Number(a.recordedYear),
            })
          ),
        });
      }

      // Graduate committees
      await tx.graduateCommittee.deleteMany({
        where: { studentId: existing.studentId },
      });
      if (
        Array.isArray(graduateCommittees) &&
        graduateCommittees.length > 0
      ) {
        await tx.graduateCommittee.createMany({
          data: graduateCommittees.map(
            (g: {
              termYear: number;
              cohort: string;
              position: string;
              remarks?: string;
            }) => ({
              studentId: existing.studentId,
              termYear: Number(g.termYear),
              fullName,
              cohort: g.cohort,
              position: g.position,
              remarks: g.remarks || null,
            })
          ),
        });
      }

      // Potentials
      await tx.potential.deleteMany({
        where: { studentId: existing.studentId },
      });
      if (hasPotentials) {
        await tx.potential.createMany({
          data: potentials.map(
            (p: {
              career: string;
              position: string;
              recordedYear: number;
            }) => ({
              studentId: existing.studentId,
              fullName,
              career: p.career,
              position: p.position,
              recordedYear: Number(p.recordedYear),
            })
          ),
        });
      }

      // Model representatives
      await tx.modelRepresentative.deleteMany({
        where: { studentId: existing.studentId },
      });
      if (hasModelReps) {
        await tx.modelRepresentative.createMany({
          data: modelRepresentatives.map(
            (m: { cohort: string; generation: number }) => ({
              studentId: existing.studentId,
              name: fullName,
              cohort: m.cohort,
              generation: Number(m.generation),
            })
          ),
        });
      }

      return updated;
    });

    // Log activity
    const session = await getSession();
    if (session) {
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
        {
          studentId: alumni.studentId,
          name: `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
          source: "update-with-related",
        },
        getIp(request)
      );
    }

    return NextResponse.json(alumni);
  } catch (error) {
    console.error("PUT /api/alumni/update-with-related/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

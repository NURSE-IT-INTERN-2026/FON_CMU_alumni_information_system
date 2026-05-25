import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AwardType } from "@/app/generated/prisma/client";
import { checkWritePermission } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const body = await request.json();
    const {
      studentId,
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
      photoUrl,
      awards,
      associations,
      graduateCommittees,
      potentials,
      modelRepresentatives,
      abroadAlumni,
    } = body;

    if (!studentId || !prefix || !firstName || !maidenLastName) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(studentId)) {
      return NextResponse.json(
        { error: "รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น" },
        { status: 400 }
      );
    }

    const existing = await prisma.alumni.findUnique({ where: { studentId } });
    if (existing) {
      return NextResponse.json(
        { error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" },
        { status: 409 }
      );
    }

    const hasPotentials = Array.isArray(potentials) && potentials.length > 0;
    const hasModelReps =
      Array.isArray(modelRepresentatives) && modelRepresentatives.length > 0;

    const alumni = await prisma.$transaction(async (tx) => {
      const created = await tx.alumni.create({
        data: {
          studentId,
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
          photoUrl: photoUrl || null,
          isPotential: hasPotentials,
          isModelRepresentative: hasModelReps,
        },
      });

      if (Array.isArray(awards) && awards.length > 0) {
        await tx.award.createMany({
          data: awards.map(
            (a: {
              awardName: string;
              awardType: string;
              year: number;
              description?: string;
            }) => ({
              studentId,
              awardName: a.awardName,
              awardType: a.awardType as AwardType,
              year: Number(a.year),
              description: a.description || null,
            })
          ),
        });
      }

      if (Array.isArray(associations) && associations.length > 0) {
        await tx.association.createMany({
          data: associations.map(
            (a: {
              fullName: string;
              associationName: string;
              position: string;
              recordedYear: number;
            }) => ({
              studentId,
              fullName: a.fullName || `${prefix}${firstName} ${maidenLastName}`,
              associationName: a.associationName,
              position: a.position,
              recordedYear: Number(a.recordedYear),
            })
          ),
        });
      }

      if (Array.isArray(graduateCommittees) && graduateCommittees.length > 0) {
        await tx.graduateCommittee.createMany({
          data: graduateCommittees.map(
            (g: {
              termYear: number;
              fullName: string;
              cohort: string;
              position: string;
              remarks?: string;
            }) => ({
              studentId,
              termYear: Number(g.termYear),
              fullName: g.fullName || `${prefix}${firstName} ${maidenLastName}`,
              cohort: g.cohort,
              position: g.position,
              remarks: g.remarks || null,
            })
          ),
        });
      }

      if (hasPotentials) {
        await tx.potential.createMany({
          data: potentials.map(
            (p: {
              fullName: string;
              career: string;
              position: string;
              recordedYear: number;
            }) => ({
              studentId,
              fullName: p.fullName || `${prefix}${firstName} ${maidenLastName}`,
              career: p.career,
              position: p.position,
              recordedYear: Number(p.recordedYear),
            })
          ),
        });
      }

      if (hasModelReps) {
        await tx.modelRepresentative.createMany({
          data: modelRepresentatives.map(
            (m: { name: string; cohort: string; generation: number }) => ({
              studentId,
              name: m.name || `${prefix}${firstName} ${maidenLastName}`,
              cohort: m.cohort,
              generation: Number(m.generation),
            })
          ),
        });
      }

      if (Array.isArray(abroadAlumni) && abroadAlumni.length > 0) {
        await tx.abroadAlumni.createMany({
          data: abroadAlumni.map(
            (a: {
              cohort?: string;
              prefix?: string;
              thaiName?: string;
              englishName?: string;
              workplace?: string;
              country: string;
              notes?: string;
              order: number;
            }) => ({
              cohort: a.cohort || null,
              prefix: a.prefix || null,
              thaiName: a.thaiName || null,
              englishName: a.englishName || null,
              workplace: a.workplace || null,
              country: a.country,
              notes: a.notes || null,
              order: Number(a.order),
            })
          ),
        });
      }

      return created;
    });

    return NextResponse.json(alumni, { status: 201 });
  } catch (error) {
    console.error("POST /api/alumni/create-with-related error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

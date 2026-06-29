import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAlumniSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { educationCreateSchema } from "@/lib/validations/education";
import { handleZodError } from "@/lib/validations";
import { generateGraduationLogs } from "@/lib/graduation-log";
import { syncNameFromHighestDegree } from "@/lib/name-sync";
import { recomputePrimaryEducation } from "@/lib/education-sync";
import { assertEducationSamePerson } from "@/lib/education-identity";
import type { DegreeLevel } from "@/app/generated/prisma/client";

// GET /api/alumni-profile/educations — the logged-in alumni's education records.
export async function GET() {
  const session = await getAlumniSession();
  if (!session?.alumni) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const rows = await prisma.education.findMany({
      where: { alumniId: session.alumni.id },
      orderBy: [{ graduationYear: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({
      data: rows,
      primaryEducationId: session.alumni.primaryEducationId ?? null,
    });
  } catch (error) {
    console.error("GET /api/alumni-profile/educations error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

// POST /api/alumni-profile/educations — the logged-in alumni adds an education.
export async function POST(request: NextRequest) {
  const session = await getAlumniSession();
  if (!session?.alumni) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const alumni = session.alumni;
  try {
    const body = await request.json();
    const validated = educationCreateSchema.parse(body);

    // Identity guard: the studentId must belong to the SAME person as this
    // alumni (birthday match) — never attach a stranger's degree.
    const profile = await prisma.alumni.findUnique({
      where: { id: alumni.id },
      select: { birthDate: true, educations: { select: { studentId: true } } },
    });
    const identityError = await assertEducationSamePerson({
      alumniBirthDate: profile?.birthDate ?? null,
      existingStudentIds: profile?.educations.map((e) => e.studentId) ?? [],
      newStudentId: validated.studentId,
    });
    if (identityError) {
      return NextResponse.json({ error: identityError }, { status: 400 });
    }

    try {
      const created = await prisma.education.create({
        data: {
          alumniId: alumni.id,
          studentId: validated.studentId,
          degreeLevel: validated.degreeLevel as DegreeLevel,
          graduationYear: validated.graduationYear ?? null,
          major: validated.major ?? null,
          cohort: validated.cohort ?? null,
          firstName: validated.firstName ?? null,
          lastName: validated.lastName ?? null,
        },
      });

      await logActivity(
        { actorType: "ALUMNI", alumniId: alumni.id, alumniName: `${alumni.prefix}${alumni.firstName} ${alumni.lastName}` },
        "CREATE",
        "education",
        created.id,
        { source: "alumni_self_add", studentId: created.studentId, degreeLevel: created.degreeLevel },
      );
      // SYSTEM graduation log + re-sync the current name from the highest degree.
      await generateGraduationLogs(alumni.id);
      await syncNameFromHighestDegree(alumni.id);
      // Primary = highest degree; a newly-added higher degree becomes primary.
      await recomputePrimaryEducation(alumni.id);

      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        const target = (error as { meta?: { target?: string[] } }).meta?.target ?? [];
        if (target.includes("studentId")) {
          return NextResponse.json({ error: "รหัสนักศึกษานี้มีอยู่แล้วในระบบ" }, { status: 409 });
        }
        return NextResponse.json({ error: "มีการศึกษาระดับปริญญานี้อยู่แล้วสำหรับท่าน" }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/alumni-profile/educations error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" }, { status: 500 });
  }
}

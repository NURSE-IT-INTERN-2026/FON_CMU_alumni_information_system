import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { educationCreateSchema } from "@/lib/validations/education";
import { handleZodError } from "@/lib/validations";
import { syncNameFromHighestDegree } from "@/lib/name-sync";
import { recomputePrimaryEducation } from "@/lib/education-sync";
import { autoLinkPendingForAlumni } from "@/lib/alumni-link";
import { assertEducationSamePerson, findStudentIdClaimOwner, claimedByOtherMessage } from "@/lib/education-identity";
import { educationRecordDetails } from "@/lib/log-payload";
import type { DegreeLevel } from "@/app/generated/prisma/client";

// Resolve an alumni by UUID or studentId (mirrors GET /api/alumni/[id]).
async function resolveAlumni(id: string) {
  return (
    (await prisma.alumni.findUnique({ where: { id } })) ??
    (await prisma.alumni.findUnique({ where: { studentId: id } }))
  );
}

// GET /api/alumni/[id]/educations — list an alumni's education records (admin).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const alumni = await resolveAlumni(id);
    if (!alumni) {
      return NextResponse.json({ error: "ไม่พบข้อมูลศิษย์เก่า" }, { status: 404 });
    }
    const rows = await prisma.education.findMany({
      where: { alumniId: alumni.id },
      orderBy: [{ graduationYear: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ data: rows, primaryEducationId: alumni.primaryEducationId });
  } catch (error) {
    console.error("GET /api/alumni/[id]/educations error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

// POST /api/alumni/[id]/educations — add an education record (admin write).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const alumni = await resolveAlumni(id);
    if (!alumni) {
      return NextResponse.json({ error: "ไม่พบข้อมูลศิษย์เก่า" }, { status: 404 });
    }

    const body = await request.json();
    const validated = educationCreateSchema.parse(body);

    // Claim guard: this studentId must not already be another alumni's
    // education record (Education.studentId is globally unique). Deterministic,
    // runs before the birthday guard (which can fail open). Admins are told
    // WHO owns it so they can resolve the conflict directly.
    const claimOwner = await findStudentIdClaimOwner(validated.studentId);
    if (claimOwner && claimOwner.alumniId !== alumni.id) {
      const owner = await prisma.alumni.findUnique({
        where: { id: claimOwner.alumniId },
        select: { prefix: true, firstName: true, lastName: true },
      });
      const ownerName = owner
        ? `${owner.prefix}${owner.firstName} ${owner.lastName}`.trim()
        : undefined;
      return NextResponse.json(
        { error: claimedByOtherMessage({ forAdmin: true, ownerName }) },
        { status: 400 },
      );
    }

    // Identity guard: the studentId must belong to the SAME person as this
    // alumni (birthday match) — never attach a stranger's degree.
    const existing = await prisma.education.findMany({
      where: { alumniId: alumni.id },
      select: { studentId: true },
    });
    const identityError = await assertEducationSamePerson({
      alumniBirthDate: alumni.birthDate,
      existingStudentIds: existing.map((e) => e.studentId),
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
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "CREATE",
        "education",
        created.id,
        { source: "admin_add", alumniId: alumni.id, ...educationRecordDetails(created) },
      );
      // Re-sync the current name from the highest degree (a separate concern
      // from logging — the auto graduation-log feature was removed).
      await syncNameFromHighestDegree(alumni.id);
      // Primary = highest degree; if this new degree outranks the current one,
      // it becomes the primary (and the snapshot re-syncs).
      await recomputePrimaryEducation(alumni.id);
      // A promotion can change Alumni.studentId — link any pending rows that now
      // match the (possibly new) primary studentId. No-op when nothing matches.
      const afterAdd = await prisma.alumni.findUnique({ where: { id: alumni.id }, select: { studentId: true } });
      if (afterAdd) {
        await autoLinkPendingForAlumni({
          alumniId: alumni.id,
          studentId: afterAdd.studentId,
          ctx: { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
          tx: prisma,
        });
      }

      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      // P2002 = unique violation: duplicate studentId, or (alumniId, degreeLevel).
      if ((error as { code?: string }).code === "P2002") {
        const target = (error as { meta?: { target?: string[] } }).meta?.target ?? [];
        if (target.includes("studentId")) {
          return NextResponse.json(
            { error: "รหัสนักศึกษานี้มีอยู่แล้วในระบบ" },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { error: "มีการศึกษาระดับปริญญานี้อยู่แล้วสำหรับศิษย์เก่าท่านนี้" },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/alumni/[id]/educations error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession, getAlumniSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { educationUpdateSchema } from "@/lib/validations/education";
import { handleZodError } from "@/lib/validations";
import { recomputePrimaryEducation } from "@/lib/education-sync";
import { assertEducationSamePerson } from "@/lib/education-identity";
import type { DegreeLevel } from "@/app/generated/prisma/client";

type WriterCtx =
  | { kind: "admin"; userId: string; userEmail: string; userRole: string }
  | { kind: "alumni"; alumniId: string; alumniName: string };

// A write is allowed for any admin, or for the alumni that owns the record.
// Returns null with no session at all.
async function resolveWriter(alumniOwnerId: string): Promise<WriterCtx | NextResponse> {
  const admin = await getSession();
  if (admin) {
    return { kind: "admin", userId: admin.user.id, userEmail: admin.user.email, userRole: admin.user.role };
  }
  const alumniSession = await getAlumniSession();
  if (alumniSession?.alumni) {
    if (alumniSession.alumni.id !== alumniOwnerId) {
      return NextResponse.json({ error: "คุณไม่มีสิทธิ์ดำเนินการนี้" }, { status: 403 });
    }
    const a = alumniSession.alumni;
    return {
      kind: "alumni",
      alumniId: a.id,
      alumniName: `${a.prefix}${a.firstName} ${a.lastName}`,
    };
  }
  return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
}

function actorOf(ctx: WriterCtx) {
  return ctx.kind === "admin"
    ? { actorType: "ADMIN" as const, userId: ctx.userId, userEmail: ctx.userEmail, userRole: ctx.userRole }
    : { actorType: "ALUMNI" as const, alumniId: ctx.alumniId, alumniName: ctx.alumniName };
}

// GET /api/educations/[id] — admin or owning alumni.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getSession();
  const alumniSession = await getAlumniSession();
  try {
    const { id } = await params;
    const edu = await prisma.education.findUnique({ where: { id } });
    if (!edu) return NextResponse.json({ error: "ไม่พบข้อมูลการศึกษา" }, { status: 404 });
    // Admin (any role) may read; otherwise only the owning alumni.
    if (!admin && alumniSession?.alumni?.id !== edu.alumniId) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    return NextResponse.json(edu);
  } catch (error) {
    console.error("GET /api/educations/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

// PUT /api/educations/[id] — admin or owning alumni. If this is the alumni's
// primary education, the denormalized Alumni snapshot is re-synced atomically.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await prisma.education.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "ไม่พบข้อมูลการศึกษา" }, { status: 404 });

    const ctx = await resolveWriter(existing.alumniId);
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const validated = educationUpdateSchema.parse(body);

    // Identity guard: if the studentId is being changed, the new one must still
    // belong to the SAME person (birthday match) — never re-point to a
    // stranger's degree.
    if (validated.studentId && validated.studentId !== existing.studentId) {
      const alumni = await prisma.alumni.findUnique({
        where: { id: existing.alumniId },
        select: { birthDate: true, educations: { select: { studentId: true } } },
      });
      const identityError = await assertEducationSamePerson({
        alumniBirthDate: alumni?.birthDate ?? null,
        existingStudentIds: (alumni?.educations ?? [])
          .map((e) => e.studentId)
          .filter((sid) => sid !== existing.studentId),
        newStudentId: validated.studentId,
      });
      if (identityError) {
        return NextResponse.json({ error: identityError }, { status: 400 });
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const edu = await tx.education.update({
          where: { id },
          data: {
            studentId: validated.studentId,
            degreeLevel: validated.degreeLevel as DegreeLevel | undefined,
            graduationYear: validated.graduationYear,
            major: validated.major,
            cohort: validated.cohort,
            firstName: validated.firstName,
            lastName: validated.lastName,
          },
        });
        // Primary = highest degree. An edit (especially degreeLevel) can change
        // which row is highest, so always recompute the primary + re-sync the
        // denormalized snapshot (studentId/degree/year/major/cohort) that the 6
        // related tables join on.
        await recomputePrimaryEducation(existing.alumniId, tx);
        return edu;
      });

      await logActivity(
        actorOf(ctx),
        "UPDATE",
        "education",
        updated.id,
        { alumniId: existing.alumniId, studentId: updated.studentId, degreeLevel: updated.degreeLevel, reason: validated.reason },
        validated.reason,
      );

      return NextResponse.json(updated);
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        const target = (error as { meta?: { target?: string[] } }).meta?.target ?? [];
        if (target.includes("studentId")) {
          return NextResponse.json({ error: "รหัสนักศึกษานี้มีอยู่แล้วในระบบ" }, { status: 409 });
        }
        return NextResponse.json({ error: "มีการศึกษาระดับปริญญานี้อยู่แล้วสำหรับศิษย์เก่าท่านนี้" }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/educations/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" }, { status: 500 });
  }
}

// DELETE /api/educations/[id] — admin or owning alumni. The primary education
// is the highest degree and is auto-derived, so ANY education may be deleted:
// if the doomed row is the primary, it is first reassigned to the next-highest
// (clearing the FK), then deleted — atomically.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await prisma.education.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "ไม่พบข้อมูลการศึกษา" }, { status: 404 });

    const ctx = await resolveWriter(existing.alumniId);
    if (ctx instanceof NextResponse) return ctx;

    await prisma.$transaction(async (tx) => {
      // Reassign primary away from this row (to the next-highest, or null) and
      // re-sync the snapshot BEFORE deleting — the primaryEducationId FK would
      // otherwise block the delete of the current primary.
      await recomputePrimaryEducation(existing.alumniId, tx, id);
      await tx.education.delete({ where: { id } });
    });

    await logActivity(
      actorOf(ctx),
      "DELETE",
      "education",
      id,
      { alumniId: existing.alumniId, studentId: existing.studentId, degreeLevel: existing.degreeLevel },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/educations/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบข้อมูล" }, { status: 500 });
  }
}

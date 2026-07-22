import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, alumniUpdateSchema } from "@/lib/validations";
import { getCmuGraduatesLocal } from "@/lib/cmu-registrar";
import { TRACKED_FIELDS, computeFieldChanges, recordFieldChanges } from "@/lib/field-changes";
import { mirrorAlumniHomeAddressToAgencies } from "@/lib/alumni-agency-home-sync";
import { autoLinkPendingForAlumni } from "@/lib/alumni-link";
import { isSamePersonByBirthday } from "@/lib/alumni-verify";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const { id } = await params;

    // The route param accepts either the alumni UUID (`id`) or its
    // `studentId` — every alumni-related table links here with whichever key
    // its row exposes (all-alumni manage rows have the UUID; the entity tables
    // + alumni-agency only carry `studentId`). Try UUID first, then studentId.
    const RELATED_INCLUDE = {
      awards: true,
      associations: true,
      graduateCommittees: true,
      potentials: true,
      modelRepresentatives: true,
      alumniAgency: true,
    } as const;

    const alumni =
      (await prisma.alumni.findUnique({
        where: { id },
        include: RELATED_INCLUDE,
      })) ??
      (await prisma.alumni.findUnique({
        where: { studentId: id },
        include: RELATED_INCLUDE,
      }));

    if (!alumni) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    return NextResponse.json(alumni);
  } catch (error) {
    console.error("GET /api/alumni/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = alumniUpdateSchema.parse(body);

    const existing = await prisma.alumni.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(validated as Record<string, unknown>)) {
      // `reason` is a log-only field, not an Alumni column.
      if (value !== undefined && key !== "reason") {
        updateData[key] = value;
      }
    }

    // Every edit locks the current name as the alumni's override — future
    // highest-degree re-syncs won't clobber a manually-edited value.
    updateData.nameManuallyUpdated = true;

    let studentIdChanged = false;
    if (updateData.studentId && updateData.studentId !== existing.studentId) {
      const newStudentId = updateData.studentId as string;
      studentIdChanged = true;

      // Can't take another local alumni's studentId (would merge two records).
      const localDuplicate = await prisma.alumni.findUnique({
        where: { studentId: newStudentId },
      });
      if (localDuplicate) {
        return NextResponse.json(
          { error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" },
          { status: 409 }
        );
      }

      // A CMU-registered id is allowed ONLY when it is the SAME person (a typo
      // correction to the alumni's own registrar record) — verified by birthday,
      // the one constant identity signal. Block a confirmed different-person id;
      // when we can't verify (no birthday on either side) fail OPEN (admin is
      // trusted — same posture as `assertEducationSamePerson`). CMU student_id
      // carries trailing spaces — trim. Reads the LOCAL cmu_graduates cache
      // (refreshed on demand from /management/settings/cmu-sync).
      const cmuMatch = (await getCmuGraduatesLocal()).find(
        (g) => String(g.student_id ?? "").trim() === newStudentId,
      );
      if (cmuMatch && isSamePersonByBirthday(cmuMatch.birthday, existing.birthDate) === false) {
        return NextResponse.json(
          { error: "รหัสนักศึกษานี้เป็นของบุคคลอื่นในระบบทะเบียน" },
          { status: 409 }
        );
      }
    }

    const alumni = await prisma.alumni.update({
      where: { id },
      data: updateData,
      include: {
        awards: true,
        associations: true,
        graduateCommittees: true,
        potentials: true,
        modelRepresentatives: true,
      },
    });

    const changes = computeFieldChanges(existing, alumni, TRACKED_FIELDS.alumni);
    const session = await getSession();
    if (session) {
      const logId = await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "alumni",
        id,
        { changes },
        validated.reason
      );
      await recordFieldChanges({ resourceType: "alumni", resourceId: id, changes, actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email }, reason: validated.reason, activityLogId: logId });
    }

    // homeAddress unification: when the alumni's address was edited, mirror it
    // onto the linked agency rows so the agency form/column stay current.
    // (alumni.studentId is post-update; an FK re-key cascades to agency rows.)
    if ("homeAddress" in updateData) {
      await mirrorAlumniHomeAddressToAgencies({ studentId: alumni.studentId, alumniHomeAddress: alumni.homeAddress ?? null });
    }

    // studentId was corrected → (1) keep the snapshot consistent with the
    // primary Education (recomputePrimaryEducation re-syncs Alumni.studentId
    // from it, so a snapshot-only edit would revert on the next education
    // touch), and (2) link any pending rows that now match the new id.
    if (studentIdChanged && session) {
      if (existing.primaryEducationId) {
        const primaryEdu = await prisma.education.findUnique({
          where: { id: existing.primaryEducationId },
          select: { studentId: true },
        });
        // Re-point only when the primary Education still holds the OLD id (the
        // common typo case). Under the same-person guard the new id is this
        // alumni's own, so no @unique (P2002) collision is possible.
        if (primaryEdu && primaryEdu.studentId === existing.studentId) {
          await prisma.education.update({
            where: { id: existing.primaryEducationId },
            data: { studentId: alumni.studentId },
          });
        }
      }
      await autoLinkPendingForAlumni({
        alumniId: alumni.id,
        studentId: alumni.studentId,
        ctx: { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        tx: prisma,
      });
    }

    return NextResponse.json(alumni);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/alumni/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลศิษย์เก่า" },
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

    const existing = await prisma.alumni.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    await prisma.alumni.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "DELETE",
        "alumni",
        id,
        { studentId: existing.studentId, name: `${existing.prefix}${existing.firstName} ${existing.lastName}` },
      );
    }

    return NextResponse.json({ message: "ลบข้อมูลศิษย์เก่าสำเร็จ" });
  } catch (error) {
    console.error("DELETE /api/alumni/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

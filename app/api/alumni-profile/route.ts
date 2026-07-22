import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { AwardType, DegreeLevel } from "@/app/generated/prisma/client";
import { getAlumniSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, alumniProfileUpdateSchema } from "@/lib/validations";
import { TRACKED_FIELDS, computeFieldChanges, recordFieldChanges } from "@/lib/field-changes";
import { mirrorAlumniHomeAddressToAgencies } from "@/lib/alumni-agency-home-sync";
import { buildSectionChanges } from "@/lib/log-payload";

const RELATED_INCLUDE = {
  awards: true,
  associations: true,
  graduateCommittees: true,
  potentials: true,
  modelRepresentatives: true,
  alumniAgency: true,
} as const;

export async function GET() {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    const alumni = await prisma.alumni.findUnique({
      where: { id: session.alumni.id },
      include: RELATED_INCLUDE,
    });

    if (!alumni) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    return NextResponse.json(alumni);
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    const alumniId = session.alumni.id;
    const studentId = session.alumni.studentId;

    const body = await request.json();
    const validated = alumniProfileUpdateSchema.parse(body);

    const hasPotentials = (validated.potentials?.length ?? 0) > 0;
    const hasModelReps = (validated.modelRepresentatives?.length ?? 0) > 0;
    const hasAbroad = (validated.alumniAgency?.length ?? 0) > 0;

    try {
      const oldCore = await prisma.alumni.findUnique({
        where: { id: alumniId },
        include: RELATED_INCLUDE,
      });
      const alumni = await prisma.$transaction(async (tx) => {
        // --- Core fields ---
        const updated = await tx.alumni.update({
          where: { id: alumniId },
          data: {
            prefix: validated.prefix,
            firstName: validated.firstName,
            lastName: validated.lastName,
            cohort: validated.cohort || null,
            degreeLevel: (validated.degreeLevel as DegreeLevel) || undefined,
            email: validated.email || null,
            contactEmail: validated.contactEmail || null,
            phones: validated.phones ?? [],
            homeAddress: validated.homeAddress?.trim() || null,
            nameManuallyUpdated: true,
            isPotential: hasPotentials,
            isModelRepresentative: hasModelReps,
          },
          include: RELATED_INCLUDE,
        });

        // --- Replace all related data (keyed by studentId) ---

        // Awards
        await tx.award.deleteMany({ where: { studentId } });
        if (validated.awards && validated.awards.length > 0) {
          await tx.award.createMany({
            data: validated.awards.map((a) => ({
              studentId,
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

        // Associations
        await tx.association.deleteMany({ where: { studentId } });
        if (validated.associations && validated.associations.length > 0) {
          await tx.association.createMany({
            data: validated.associations.map((a) => ({
              studentId,
              prefix: validated.prefix,
              firstName: validated.firstName,
              lastName: validated.lastName,
              associationName: a.associationName,
              position: a.position,
              recordedYear: a.recordedYear,
            })),
          });
        }

        // Graduate committees
        await tx.graduateCommittee.deleteMany({ where: { studentId } });
        if (
          validated.graduateCommittees &&
          validated.graduateCommittees.length > 0
        ) {
          await tx.graduateCommittee.createMany({
            data: validated.graduateCommittees.map((g) => ({
              studentId,
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

        // Potentials
        await tx.potential.deleteMany({ where: { studentId } });
        if (hasPotentials) {
          await tx.potential.createMany({
            data: validated.potentials!.map((p) => ({
              studentId,
              prefix: validated.prefix,
              firstName: validated.firstName,
              lastName: validated.lastName,
              career: p.career,
              position: p.position,
              recordedYear: p.recordedYear,
            })),
          });
        }

        // Model representatives
        await tx.modelRepresentative.deleteMany({ where: { studentId } });
        if (hasModelReps) {
          await tx.modelRepresentative.createMany({
            data: validated.modelRepresentatives!.map((m) => ({
              studentId,
              prefix: validated.prefix,
              firstName: validated.firstName,
              lastName: validated.lastName,
              cohort: m.cohort,
              generation: m.generation,
            })),
          });
        }

        // Abroad alumni (only touches rows linked to this studentId;
        // imported flat-list rows with studentId = null are left alone).
        await tx.alumniAgency.deleteMany({ where: { studentId } });
        if (hasAbroad) {
          await tx.alumniAgency.createMany({
            data: validated.alumniAgency!.map((a, idx) => ({
              studentId,
              // Identity fields are auto-filled from the alumni record:
              prefix: validated.prefix,
              firstName: validated.firstName,
              lastName: validated.lastName,
              cohort: validated.cohort || null,
              // Alumni-owned fields:
              workplace: a.workplace || null,
              homeAddress: a.homeAddress || null,
              country: a.country,
              notes: a.notes || null,
              order: idx, // column has no DB default
            })),
          });
        }

        // homeAddress unification: alumni is the single source of truth — mirror
        // it onto the (just-recreated) linked agency rows so they reflect it.
        // Runs AFTER the agency recreate so it covers the fresh rows.
        await mirrorAlumniHomeAddressToAgencies({ studentId, alumniHomeAddress: updated.homeAddress ?? null, tx });

        return updated;
      });

      // Log alumni profile edit + field-change history
      const changes = computeFieldChanges(oldCore, alumni, TRACKED_FIELDS.alumni_profile);
      // What the alumni added/removed in each related section (old DB rows vs
      // the submitted payload) — richer than the bare section counts.
      const sectionChanges = buildSectionChanges(
        {
          awards: (oldCore?.awards ?? []) as unknown as Record<string, unknown>[],
          associations: (oldCore?.associations ?? []) as unknown as Record<string, unknown>[],
          graduateCommittees: (oldCore?.graduateCommittees ?? []) as unknown as Record<string, unknown>[],
          potentials: (oldCore?.potentials ?? []) as unknown as Record<string, unknown>[],
          modelRepresentatives: (oldCore?.modelRepresentatives ?? []) as unknown as Record<string, unknown>[],
          alumniAgency: (oldCore?.alumniAgency ?? []) as unknown as Record<string, unknown>[],
        },
        {
          awards: (validated.awards ?? []) as unknown as Record<string, unknown>[],
          associations: (validated.associations ?? []) as unknown as Record<string, unknown>[],
          graduateCommittees: (validated.graduateCommittees ?? []) as unknown as Record<string, unknown>[],
          potentials: (validated.potentials ?? []) as unknown as Record<string, unknown>[],
          modelRepresentatives: (validated.modelRepresentatives ?? []) as unknown as Record<string, unknown>[],
          alumniAgency: (validated.alumniAgency ?? []) as unknown as Record<string, unknown>[],
        },
      );
      const logId = await logActivity(
        {
          actorType: "ALUMNI",
          alumniId: alumni.id,
          alumniName: `${alumni.prefix}${alumni.firstName} ${alumni.lastName}`,
        },
        "UPDATE",
        "alumni_profile",
        alumni.id,
        {
          source: "alumni_self_edit",
          changes,
          sections: {
            awards: validated.awards?.length ?? 0,
            associations: validated.associations?.length ?? 0,
            graduateCommittees: validated.graduateCommittees?.length ?? 0,
            potentials: validated.potentials?.length ?? 0,
            modelRepresentatives: validated.modelRepresentatives?.length ?? 0,
            alumniAgency: validated.alumniAgency?.length ?? 0,
          },
          ...(sectionChanges ? { sectionChanges } : {}),
        },
        validated.reason
      );
      await recordFieldChanges({ resourceType: "alumni_profile", resourceId: alumni.id, changes, actor: { actorType: "ALUMNI", alumniId: alumni.id, actorName: `${alumni.prefix}${alumni.firstName} ${alumni.lastName}` }, reason: validated.reason, activityLogId: logId });

      return NextResponse.json(alumni);
    } catch (error) {
      // P2002 = unique-constraint violation (duplicate email, or a repeated
      // row within one payload hitting a relation @@unique).
      if ((error as { code?: string }).code === "P2002") {
        const target = (error as { meta?: { target?: string[] } }).meta?.target;
        if (target?.includes("email")) {
          return NextResponse.json(
            { error: "อีเมลนี้ถูกใช้งานแล้ว" },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: "มีข้อมูลที่ซ้ำกันในรายการเดียวกัน กรุณาตรวจสอบอีกครั้ง" },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/alumni-profile error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    const alumniId = session.alumni.id;

    // Atomic soft-delete: end every session for this alumni AND tombstone the
    // record in one transaction. The row stays so admins can review/restore it.
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { alumniId } }),
      prisma.alumni.update({
        where: { id: alumniId },
        data: { deletedAt: new Date() },
      }),
    ]);

    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId,
        alumniName: `${session.alumni.prefix}${session.alumni.firstName} ${session.alumni.lastName}`,
      },
      "DELETE",
      "alumni_profile",
      alumniId,
      { source: "alumni_self_delete" },
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบข้อมูล" },
      { status: 500 }
    );
  }
}

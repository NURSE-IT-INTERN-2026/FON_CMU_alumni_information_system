import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import { recomputePrimaryEducation } from "@/lib/education-sync";
import { generateGraduationLogs } from "@/lib/graduation-log";
import { sendSignupApprovedEmail } from "@/lib/email";
import { cmuLevelToDegree } from "@/lib/alumni-verify";
import type { DegreeLevel } from "@/app/generated/prisma/client";
import { bustCache } from "@/lib/cache";

// Approve a pending (or previously rejected) alumni signup → accountStatus
// ACTIVE. Creates the Education row + primary snapshot + graduation logs that
// signup deferred (so a rejected signup never pollutes degree data). Notifies
// the alumni by email on a real transition into ACTIVE.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await checkWritePermission();
    if (denied) return denied;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const { id } = await params;

    const alumni = await prisma.alumni.findUnique({ where: { id } });
    if (!alumni) {
      return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });
    }

    const wasActive = alumni.accountStatus === "ACTIVE";

    // CMU-authoritative values for the Education row (best-effort; falls back to
    // the alumni snapshot if CMU is unavailable at approval time).
    let cmuGrad = null;
    try {
      cmuGrad = await fetchCmuGraduateById(alumni.studentId);
    } catch {
      cmuGrad = null;
    }
    const degreeLevel = cmuGrad
      ? cmuLevelToDegree(cmuGrad.level_id, cmuGrad.major_name_th)
      : alumni.degreeLevel;
    const gy = cmuGrad?.grad_year ? Number(cmuGrad.grad_year) : NaN;

    await prisma.$transaction(async (tx) => {
      await tx.alumni.update({
        where: { id },
        data: {
          accountStatus: "ACTIVE",
          // Clean slate on approval — the prior rejection is moot now (its full
          // history remains in ActivityLog). Lets a later rejection start fresh.
          rejectionReason: null,
          rejectedAt: null,
          // An admin may approve straight from UNVERIFIED (override, e.g. an
          // applicant who verified in person) — record the email-verified time
          // so the audit timestamp is correct.
          ...(alumni.accountStatus === "UNVERIFIED"
            ? { emailVerifiedAt: new Date() }
            : {}),
        },
      });

      // Ensure an Education row exists for this signup degree, then let the
      // primary (highest degree) + denormalized snapshot re-sync from it.
      const existingEdu = await tx.education.findUnique({
        where: { studentId: alumni.studentId },
      });
      if (!existingEdu) {
        await tx.education.create({
          data: {
            alumniId: id,
            studentId: alumni.studentId,
            degreeLevel: degreeLevel as DegreeLevel,
            graduationYear:
              Number.isFinite(gy) && gy > 0 ? gy : alumni.graduationYear,
            major: cmuGrad?.major_name_th?.trim() || alumni.major,
            cohort: alumni.cohort,
            firstName: cmuGrad?.name_th?.trim() || alumni.firstName,
            lastName: cmuGrad?.surname_th?.trim() || alumni.lastName,
          },
        });
      }
      // Primary = highest degree; assign it (and re-sync the snapshot) for the
      // signup degree. Idempotent on re-approve.
      await recomputePrimaryEducation(id, tx);
    });

    // The dashboard "pending approvals" card counts accountStatus — bust so it's
    // fresh right after an approval.
    bustCache("dashboard");

    // Graduation logs do their own CMU fetches — run outside the txn (idempotent).
    await generateGraduationLogs(id);

    await logActivity(
      {
        actorType: "ADMIN",
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: session.user.role,
      },
      "APPROVE",
      "alumni_auth",
      id,
      {
        alumniName: `${alumni.prefix}${alumni.firstName} ${alumni.lastName}`,
        studentId: alumni.studentId,
      },
    );

    // Notify only on a real transition into ACTIVE (not an idempotent re-approve).
    if (!wasActive && alumni.email) {
      try {
        await sendSignupApprovedEmail(
          alumni.email,
          `${alumni.prefix}${alumni.firstName} ${alumni.lastName}`.trim(),
        );
      } catch (err) {
        console.error("Failed to send signup-approved email:", err);
      }
    }

    return NextResponse.json({ success: true, accountStatus: "ACTIVE" });
  } catch (error) {
    console.error("POST /api/alumni-accounts/[id]/approve error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดำเนินการ" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import {
  buildSignupVerification,
  type SignupVerification,
} from "@/lib/signup-verification";
import { Prisma } from "@/app/generated/prisma/client";

// Re-fetch the CMU Registrar and rebuild the per-field verification snapshot,
// e.g. when CMU was unreachable (or the studentId wasn't found) at signup. The
// original submitted values are read back from the stored snapshot so the
// comparison stays faithful to what the applicant entered.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await checkWritePermission();
    if (denied) return denied;
    const { id } = await params;

    const alumni = await prisma.alumni.findUnique({ where: { id } });
    if (!alumni) {
      return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });
    }

    // Reconstruct the raw submitted values: prefer the stored snapshot, fall
    // back to the alumni snapshot fields.
    const stored = (alumni.signupVerification as SignupVerification | null) ?? null;
    const submitted = {
      studentId: stored?.submitted.studentId ?? alumni.studentId,
      firstName: stored?.submitted.firstName ?? alumni.firstName,
      lastName: stored?.submitted.lastName ?? alumni.lastName,
      birthDate: stored?.submitted.birthDate ?? alumni.birthDate ?? "",
      cohort: stored?.submitted.cohort ?? alumni.cohort ?? "",
      degreeLevel: stored?.submitted.degreeLevel ?? alumni.degreeLevel,
    };

    let cmuGrad = null;
    let cmuConsulted = false;
    try {
      cmuGrad = await fetchCmuGraduateById(submitted.studentId);
      cmuConsulted = true;
    } catch {
      cmuConsulted = false;
    }

    const verification = buildSignupVerification(submitted, cmuGrad, cmuConsulted);
    await prisma.alumni.update({
      where: { id },
      data: { signupVerification: verification as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({ success: true, verification });
  } catch (error) {
    console.error("POST /api/alumni-accounts/[id]/reverify error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดำเนินการ" },
      { status: 500 }
    );
  }
}

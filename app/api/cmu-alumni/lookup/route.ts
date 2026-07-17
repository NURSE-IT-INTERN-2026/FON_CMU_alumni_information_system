import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, getAlumniSession } from "@/lib/auth";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import { cmuToAlumniFields } from "@/lib/ensure-alumni";
import { assertEducationSamePerson, findStudentIdClaimOwner, claimedByOtherMessage } from "@/lib/education-identity";

// GET /api/cmu-alumni/lookup?studentId=… — look up one CMU Registrar record by
// studentId and return the education-relevant fields, for the add-education
// form's auto-fill preview. Admin or logged-in alumni only.
export async function GET(request: NextRequest) {
  const admin = await getSession();
  const alumni = await getAlumniSession();
  if (!admin && !alumni?.alumni) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const studentId = request.nextUrl.searchParams.get("studentId")?.trim();
  if (!studentId) {
    return NextResponse.json({ error: "กรุณาระบุรหัสนักศึกษา" }, { status: 400 });
  }
  // Optional: the alumni this education would belong to. When provided AND the
  // caller is authorized for that alumni, flag if the looked-up record belongs
  // to a different person (so the add-education form can warn before saving).
  const alumniId = request.nextUrl.searchParams.get("alumniId")?.trim() || null;

  try {
    const grad = await fetchCmuGraduateById(studentId);
    if (!grad) {
      return NextResponse.json({ error: "ไม่พบข้อมูลในระบบทะเบียน" }, { status: 404 });
    }
    const f = cmuToAlumniFields(grad);

    let samePersonWarning: string | null = null;
    let alreadyClaimed: string | null = null;
    if (alumniId && (admin || alumni?.alumni?.id === alumniId)) {
      // Claim preview: is this studentId already another alumni's education
      // record? Deterministic (DB-only), so it warns even when the birthday
      // (same-person) check below can't verify. Admins are told who owns it.
      const claimOwner = await findStudentIdClaimOwner(studentId);
      if (claimOwner && claimOwner.alumniId !== alumniId) {
        if (admin) {
          const o = await prisma.alumni.findUnique({
            where: { id: claimOwner.alumniId },
            select: { prefix: true, firstName: true, lastName: true },
          });
          alreadyClaimed = claimedByOtherMessage({
            forAdmin: true,
            ownerName: o ? `${o.prefix}${o.firstName} ${o.lastName}`.trim() : undefined,
          });
        } else {
          alreadyClaimed = claimedByOtherMessage({ forAdmin: false });
        }
      }

      const a = await prisma.alumni.findUnique({
        where: { id: alumniId },
        select: { birthDate: true, educations: { select: { studentId: true } } },
      });
      if (a) {
        samePersonWarning = await assertEducationSamePerson({
          alumniBirthDate: a.birthDate,
          existingStudentIds: a.educations.map((e) => e.studentId),
          newStudentId: studentId,
        });
      }
    }

    return NextResponse.json({
      studentId: String(grad.student_id ?? "").trim(),
      degreeLevel: f.degreeLevel,
      graduationYear: f.graduationYear,
      major: f.major,
      cohort: f.cohort,
      firstName: f.firstName,
      lastName: f.lastName,
      samePersonWarning,
      alreadyClaimed,
    });
  } catch (error) {
    console.error("GET /api/cmu-alumni/lookup error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบทะเบียน" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { bustCache, bustCachePrefix } from "@/lib/cache";
import { handleZodError, passwordField } from "@/lib/validations/helpers";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import { buildSignupVerification } from "@/lib/signup-verification";
import { DEGREE_LEVEL_VALUES } from "@/lib/validations/alumni";
import { Prisma, type DegreeLevel } from "@/app/generated/prisma/client";

// Re-submit a REJECTED application with corrected data → straight back to
// PENDING (the admin queue). The email was already verified at the original
// signup, so NO new email-verification token/email is created (decision: skip
// re-verify). Identity is proven by email + the existing account's password.

const reapplySchema = z.object({
  email: z.string().min(1, "กรุณากรอกอีเมล").email("รูปแบบอีเมลไม่ถูกต้อง"),
  // The account's existing password — used to prove identity (not changed here).
  password: passwordField(),
  studentId: z.string().min(1, "กรุณากรอกรหัสนักศึกษา"),
  cohort: z.string().min(1, "กรุณากรอกปีที่จบ"),
  degreeLevel: z.enum(DEGREE_LEVEL_VALUES, {
    message: "กรุณาเลือกระดับการศึกษา",
  }),
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุลเดิม"),
  birthDate: z
    .string()
    .min(1, "กรุณากรอกวันเกิด")
    .regex(/^\d{8}$/, "รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น DDMMYYYY"),
});

export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0].trim() ??
      headerStore.get("x-real-ip") ??
      "unknown";

    const rateLimit = checkRateLimit(`reapply:${ip}`);
    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
      return NextResponse.json(
        { error: "ลองยื่นคำขอใหม่มากเกินไป กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const v = reapplySchema.parse(await request.json());
    const email = v.email.trim().toLowerCase();
    const studentId = v.studentId.trim();
    const firstName = v.firstName.trim();
    const lastName = v.lastName.trim();
    const cohort = v.cohort.trim();

    // 1. Identity: find the account by email + verify the password matches.
    const alumni = await prisma.alumni.findFirst({
      where: { email, deletedAt: null },
    });
    // Generic 401 for not-found / no-credentials / wrong password (don't leak).
    if (!alumni || !alumni.passwordHash) {
      return NextResponse.json(
        { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีไม่สามารถยื่นคำขอใหม่ได้" },
        { status: 401 }
      );
    }
    const valid = await verifyPassword(v.password, alumni.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีไม่สามารถยื่นคำขอใหม่ได้" },
        { status: 401 }
      );
    }
    // Only a REJECTED account can re-apply.
    if (alumni.accountStatus !== "REJECTED") {
      return NextResponse.json(
        { error: "บัญชีของท่านยังไม่ถูกปฏิเสธ จึงไม่สามารถยื่นคำขอใหม่ได้" },
        { status: 403 }
      );
    }

    // 2. If the studentId changed, ensure it isn't claimed by another account.
    if (studentId !== alumni.studentId) {
      const clash = await prisma.alumni.findUnique({ where: { studentId } });
      if (clash && clash.id !== alumni.id) {
        return NextResponse.json(
          { error: "รหัสนักศึกษานี้ถูกใช้โดยบัญชีอื่นแล้ว" },
          { status: 409 }
        );
      }
    }

    // 3. Rebuild the CMU comparison snapshot with the (possibly corrected) data.
    let cmuGrad = null;
    let cmuConsulted = false;
    try {
      cmuGrad = await fetchCmuGraduateById(studentId);
      cmuConsulted = true;
    } catch {
      cmuConsulted = false;
    }
    const verification = buildSignupVerification(
      {
        studentId,
        firstName,
        lastName,
        birthDate: v.birthDate,
        cohort,
        degreeLevel: v.degreeLevel,
      },
      cmuGrad,
      cmuConsulted,
      null,
    );

    // 4. Update identity fields + snapshot, flip to PENDING. Keep emailVerifiedAt
    //    (email already verified) and rejectionReason/rejectedAt (so the admin
    //    sees why they rejected before; cleared on a later approval). No
    //    Education/verification-token creation here.
    try {
      await prisma.alumni.update({
        where: { id: alumni.id },
        data: {
          studentId,
          firstName,
          lastName,
          cohort,
          birthDate: v.birthDate,
          degreeLevel: v.degreeLevel as DegreeLevel,
          signupVerification: verification as unknown as Prisma.InputJsonValue,
          accountStatus: "PENDING",
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "รหัสนักศึกษานี้ถูกใช้โดยบัญชีอื่นแล้ว" },
          { status: 409 }
        );
      }
      throw error;
    }

    // The dashboard "pending approvals" card + alumni-accounts list counts must
    // reflect the re-submitted PENDING account.
    bustCache("dashboard");
    bustCachePrefix("alumni");

    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId: alumni.id,
        alumniName: `${firstName} ${lastName}`,
      },
      "REAPPLY",
      "alumni_auth",
      alumni.id,
      { email, studentId },
    );

    // No session is created — the alumni waits for admin approval (like PENDING).
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/alumni-auth/reapply error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

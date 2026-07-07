import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, passwordField } from "@/lib/validations/helpers";
import { sendEmailVerificationEmail } from "@/lib/email";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import {
  buildSignupVerification,
  localAuthoritativeFromAlumni,
} from "@/lib/signup-verification";
import { DEGREE_LEVEL_VALUES } from "@/lib/validations/alumni";
import { Prisma, type DegreeLevel } from "@/app/generated/prisma/client";

const alumniSignupApiSchema = z.object({
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
  email: z.string().min(1, "กรุณากรอกอีเมล").email("รูปแบบอีเมลไม่ถูกต้อง"),
  password: passwordField(),
});

export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0].trim() ??
      headerStore.get("x-real-ip") ??
      "unknown";

    const rateLimit = checkRateLimit(`signup:${ip}`);
    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
      return NextResponse.json(
        { error: "ลองลงทะเบียนมากเกินไป กรุณารอสักครู่แล้วลองใหม่" },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const validated = alumniSignupApiSchema.parse(body);

    const email = validated.email.trim().toLowerCase();
    const studentId = validated.studentId.trim();
    const firstName = validated.firstName.trim();
    const lastName = validated.lastName.trim();
    const cohort = validated.cohort.trim();

    // 1. Email dedup (application-level guard; @unique is the DB backstop)
    const existingByEmail = await prisma.alumni.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existingByEmail) {
      return NextResponse.json(
        { error: "อีเมลนี้ถูกใช้ลงทะเบียนแล้ว กรุณาใช้อีเมลอื่น" },
        { status: 409 }
      );
    }

    // 2. Local lookup by studentId (unique)
    const localAlumni = await prisma.alumni.findUnique({
      where: { studentId },
    });

    // Already-registered account (credentials exist). Tailor the message to the
    // account's status so the applicant knows where they stand.
    if (localAlumni?.passwordHash) {
      const status = localAlumni.accountStatus;
      const msg =
        status === "UNVERIFIED"
          ? "บัญชีของท่านรอยืนยันอีเมล กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน"
          : status === "PENDING"
            ? "บัญชีของท่านอยู่ระหว่างตรวจสอบ กรุณารอการอนุมัติจากผู้ดูแลระบบ"
            : status === "REJECTED"
              ? "การลงทะเบียนของท่านถูกปฏิเสธ ท่านสามารถยื่นคำขอใหม่ได้ที่หน้าเข้าสู่ระบบ"
              : "ท่านได้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ";
      return NextResponse.json({ error: msg, code: status }, { status: 409 });
    }

    // 3. Best-effort CMU lookup to capture the per-field comparison snapshot for
    //    the admin review. The admin is the gatekeeper — a mismatch is NOT a hard
    //    block here (unlike the old auto-activate flow). If CMU is unreachable or
    //    the studentId isn't found, we still create the PENDING account; the
    //    snapshot records that and the admin can re-verify later.
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
        birthDate: validated.birthDate,
        cohort,
        degreeLevel: validated.degreeLevel,
      },
      cmuGrad,
      cmuConsulted,
      // When this is a pre-existing local alumni (no CMU record), compare the
      // applicant's submitted data against the LOCAL record's identity instead
      // of showing a bare "not found". localAlumni still holds its pre-update
      // identity here (the update happens below).
      localAlumni ? localAuthoritativeFromAlumni(localAlumni) : null,
    );

    // 4. Upsert an UNVERIFIED account. No auto-login, no session/cookie, no
    //    hasLoggedIn — the applicant must confirm email ownership, then an admin
    //    must approve. Education/snapshot/grad-log creation is deferred to
    //    approval so a rejected (e.g. fabricated) signup never pollutes degree
    //    data.
    const passwordHash = await hashPassword(validated.password);
    let alumniId: string;

    try {
      if (localAlumni) {
        // Existing imported/CMU-only row: attach credentials + flip to UNVERIFIED.
        // Leave its identity fields intact (they're already authoritative); the
        // submitted data lives in `signupVerification` for the admin to compare.
        await prisma.alumni.update({
          where: { id: localAlumni.id },
          data: {
            email,
            passwordHash,
            accountStatus: "UNVERIFIED",
            signupVerification: verification as unknown as Prisma.InputJsonValue,
          },
        });
        alumniId = localAlumni.id;
      } else {
        const created = await prisma.alumni.create({
          data: {
            studentId,
            firstName,
            lastName,
            cohort,
            birthDate: validated.birthDate,
            prefix: "-",
            degreeLevel: validated.degreeLevel as DegreeLevel,
            email,
            passwordHash,
            accountStatus: "UNVERIFIED",
            signupVerification: verification as unknown as Prisma.InputJsonValue,
          },
        });
        alumniId = created.id;
      }
    } catch (error) {
      // P2002 = unique violation (email/studentId race) → 409
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          {
            error:
              "ไม่สามารถลงทะเบียนได้ อีเมลหรือรหัสนักศึกษานี้ถูกใช้แล้ว",
          },
          { status: 409 }
        );
      }
      throw error;
    }

    // 5. Issue an email-verification token and send the confirmation email. Best
    //    effort: a send failure is logged but does NOT fail the signup — the
    //    account exists as UNVERIFIED and the applicant can resend from the
    //    signup page or login screen.
    const verifyToken = randomBytes(32).toString("hex");
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await prisma.emailVerification.create({
      data: { alumniId, token: verifyToken, expiresAt: verifyExpiresAt },
    });
    try {
      await sendEmailVerificationEmail(email, `${firstName} ${lastName}`, verifyToken);
    } catch (err) {
      console.error("Failed to send email-verification email:", err);
    }

    // A new signup does NOT enter the admin pending queue until the email is
    // verified (UNVERIFIED → PENDING), so the dashboard "pending approvals"
    // count is unchanged here; no cache bust needed yet.

    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId,
        alumniName: `${firstName} ${lastName}`,
      },
      "SIGNUP",
      "alumni_auth",
      alumniId,
      {
        email,
        source:
          cmuConsulted && cmuGrad
            ? "cmu"
            : cmuConsulted
              ? "cmu-not-found"
              : "cmu-unavailable",
      },
    );

    // No session is created — the applicant must verify their email, then wait
    // for admin approval. The signup page shows a "check your email" success
    // state with a resend option.
    return NextResponse.json({ success: true, unverified: true });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

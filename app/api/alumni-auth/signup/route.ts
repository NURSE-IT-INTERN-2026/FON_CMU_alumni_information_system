import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, passwordField } from "@/lib/validations/helpers";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import { buildSignupVerification } from "@/lib/signup-verification";
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
        status === "PENDING"
          ? "บัญชีของท่านอยู่ระหว่างตรวจสอบ กรุณารอการอนุมัติจากผู้ดูแลระบบ"
          : status === "REJECTED"
            ? "การลงทะเบียนของท่านถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ"
            : "ท่านได้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ";
      return NextResponse.json({ error: msg }, { status: 409 });
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
    );

    // 4. Upsert a PENDING account. No auto-login, no session/cookie, no
    //    hasLoggedIn — the admin must approve first. Education/snapshot/grad-log
    //    creation is deferred to approval so a rejected (e.g. fabricated) signup
    //    never pollutes degree data.
    const passwordHash = await hashPassword(validated.password);
    let alumniId: string;

    try {
      if (localAlumni) {
        // Existing imported/CMU-only row: attach credentials + flip to PENDING.
        // Leave its identity fields intact (they're already authoritative); the
        // submitted data lives in `signupVerification` for the admin to compare.
        await prisma.alumni.update({
          where: { id: localAlumni.id },
          data: {
            email,
            passwordHash,
            accountStatus: "PENDING",
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
            accountStatus: "PENDING",
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

    // No session is created — the applicant must wait for admin approval. The
    // signup page shows a "pending review" success state.
    return NextResponse.json({ success: true, pending: true });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

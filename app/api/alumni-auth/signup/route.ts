import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  hashPassword,
  createAlumniSession,
  setSessionCookie,
} from "@/lib/auth";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { logActivity, getIp } from "@/lib/activity-log";
import { handleZodError, passwordField } from "@/lib/validations/helpers";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import {
  matchCmuGraduate,
  cmuLevelToDegree,
  normalizeFormBirthDate,
  normalizeName,
  normalizeYear,
  isYearLike,
} from "@/lib/alumni-verify";

const alumniSignupApiSchema = z.object({
  studentId: z.string().min(1, "กรุณากรอกรหัสนักศึกษา"),
  cohort: z.string().min(1, "กรุณากรอกปีที่จบ"),
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  maidenLastName: z.string().min(1, "กรุณากรอกนามสกุลเดิม"),
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
    const maidenLastName = validated.maidenLastName.trim();
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

    // Same alumni already registered
    if (localAlumni?.passwordHash) {
      return NextResponse.json(
        { error: "ท่านได้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ" },
        { status: 409 }
      );
    }

    // 3. Local verification: names must match; cohort enforced only when the
    //    stored value is a 4-digit year (local data may use "รุ่น N"); birthDate
    //    enforced only when stored (both stored & input are Buddhist DDMMYYYY).
    let localVerified = false;
    if (localAlumni) {
      const nameOk =
        normalizeName(localAlumni.firstName) === normalizeName(firstName) &&
        normalizeName(localAlumni.maidenLastName) === normalizeName(maidenLastName);
      const cohortOk =
        !isYearLike(localAlumni.cohort) ||
        normalizeYear(localAlumni.cohort) === normalizeYear(cohort);
      const birthOk =
        !localAlumni.birthDate ||
        normalizeFormBirthDate(localAlumni.birthDate) ===
          normalizeFormBirthDate(validated.birthDate);
      localVerified = nameOk && cohortOk && birthOk;
    }

    // 4. CMU verification fallback
    let cmuGrad = null;
    let cmuVerified = false;
    if (!localVerified) {
      try {
        cmuGrad = await fetchCmuGraduateById(studentId);
      } catch {
        // Registrar unreachable — surface a distinct error, not "info mismatch"
        return NextResponse.json(
          {
            error:
              "ไม่สามารถติดต่อระบบทะเบียนเพื่อยืนยันข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
          },
          { status: 503 }
        );
      }
      cmuVerified = cmuGrad
        ? matchCmuGraduate(cmuGrad, {
            studentId,
            cohort,
            firstName,
            maidenLastName,
            birthDate: validated.birthDate,
          })
        : false;
    }

    if (!localVerified && !cmuVerified) {
      return NextResponse.json(
        {
          error:
            "ข้อมูลไม่ตรงกับหลักฐานการศึกษา กรุณาตรวจสอบและลองใหม่อีกครั้ง",
        },
        { status: 400 }
      );
    }

    // 5. Upsert local record keyed on unique studentId
    const passwordHash = await hashPassword(validated.password);
    const now = new Date();
    let alumniId: string;

    try {
      if (localAlumni) {
        await prisma.alumni.update({
          where: { id: localAlumni.id },
          data: {
            email,
            passwordHash,
            hasLoggedIn: true,
            lastLoginAt: now,
            // Backfill missing identity fields from verified CMU data
            ...(cmuVerified && cmuGrad
              ? {
                  cohort: localAlumni.cohort ?? cmuGrad.grad_year,
                  birthDate: localAlumni.birthDate ?? validated.birthDate,
                  firstName: localAlumni.firstName || firstName,
                  maidenLastName: localAlumni.maidenLastName || maidenLastName,
                }
              : {}),
          },
        });
        alumniId = localAlumni.id;
      } else {
        const created = await prisma.alumni.create({
          data: {
            studentId,
            firstName,
            maidenLastName,
            cohort,
            birthDate: validated.birthDate,
            prefix: "-",
            degreeLevel: cmuGrad
              ? cmuLevelToDegree(cmuGrad.level_id, cmuGrad.major_name_th)
              : "BACHELOR",
            email,
            passwordHash,
            hasLoggedIn: true,
            lastLoginAt: now,
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

    // 6. Auto-login: alumni session + cookie, then redirect to profile
    resetRateLimit(`signup:${ip}`);
    const token = await createAlumniSession(alumniId);
    const cookieStore = await cookies();
    cookieStore.set(setSessionCookie(token));

    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId,
        alumniName: `${firstName} ${maidenLastName}`,
      },
      "SIGNUP",
      "alumni_auth",
      alumniId,
      {
        email,
        source: cmuVerified ? "cmu" : "local",
      },
      getIp(request)
    );

    return NextResponse.json({
      success: true,
      redirect: "/graduates/profile",
    });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

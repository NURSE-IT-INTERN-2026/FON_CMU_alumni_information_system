import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity, getIp } from "@/lib/activity-log";
import { handleZodError, passwordField } from "@/lib/validations/helpers";

const alumniSignupApiSchema = z.object({
  studentId: z.string().min(1, "กรุณากรอกรหัสนักศึกษา"),
  cohort: z.string().min(1, "กรุณากรอกรุ่น/สาขา"),
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

    // Look up alumni matching all 5 identity fields
    const alumni = await prisma.alumni.findFirst({
      where: {
        studentId: validated.studentId,
        cohort: validated.cohort,
        firstName: { equals: validated.firstName.trim(), mode: "insensitive" },
        maidenLastName: { equals: validated.maidenLastName.trim(), mode: "insensitive" },
        birthDate: validated.birthDate,
      },
    });

    if (!alumni) {
      // No exact match — don't reject, let admin verify instead
      const existingByStudentId = await prisma.alumni.findUnique({
        where: { studentId: validated.studentId },
      });

      if (existingByStudentId) {
        // Student ID exists but other details don't match
        if (existingByStudentId.passwordHash) {
          return NextResponse.json(
            { error: "ท่านได้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ" },
            { status: 409 }
          );
        }

        const passwordHash = await hashPassword(validated.password);
        await prisma.alumni.update({
          where: { id: existingByStudentId.id },
          data: {
            passwordHash,
            email: validated.email.trim().toLowerCase(),
            approvalStatus: "PENDING",
          },
        });

        await logActivity(
          {
            actorType: "ALUMNI",
            alumniId: existingByStudentId.id,
            alumniName: `${existingByStudentId.firstName} ${existingByStudentId.maidenLastName}`,
          },
          "SIGNUP",
          "alumni_auth",
          existingByStudentId.id,
          { email: validated.email.trim().toLowerCase(), matchType: "studentId_only" },
          getIp(request)
        );

        return NextResponse.json({
          success: true,
          message: "ลงทะเบียนสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติบัญชีของท่าน",
        });
      }

      // No record at all — create new alumni for admin to verify
      const passwordHash = await hashPassword(validated.password);
      const newAlumni = await prisma.alumni.create({
        data: {
          studentId: validated.studentId,
          firstName: validated.firstName.trim(),
          maidenLastName: validated.maidenLastName.trim(),
          cohort: validated.cohort,
          birthDate: validated.birthDate,
          prefix: "-",
          degreeLevel: "BACHELOR",
          email: validated.email.trim().toLowerCase(),
          passwordHash,
          approvalStatus: "PENDING",
        },
      });

      await logActivity(
        {
          actorType: "ALUMNI",
          alumniId: newAlumni.id,
          alumniName: `${newAlumni.firstName} ${newAlumni.maidenLastName}`,
        },
        "SIGNUP",
        "alumni_auth",
        newAlumni.id,
        { email: validated.email.trim().toLowerCase(), matchType: "new_record" },
        getIp(request)
      );

      return NextResponse.json({
        success: true,
        message: "ลงทะเบียนสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติบัญชีของท่าน",
      });
    }

    // Check if already signed up
    if (alumni.passwordHash) {
      return NextResponse.json(
        { error: "ท่านได้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ" },
        { status: 409 }
      );
    }

    // Check if already has a pending or approved OAuth signup
    if (alumni.approvalStatus === "PENDING") {
      return NextResponse.json(
        { error: "ท่านได้ลงทะเบียนแล้ว กรุณารอผู้ดูแลระบบอนุมัติบัญชีของท่าน" },
        { status: 409 }
      );
    }

    // Hash password and update alumni record with PENDING status
    const passwordHash = await hashPassword(validated.password);
    await prisma.alumni.update({
      where: { id: alumni.id },
      data: {
        passwordHash,
        email: validated.email.trim().toLowerCase(),
        approvalStatus: "PENDING",
      },
    });

    // Log activity
    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId: alumni.id,
        alumniName: `${alumni.firstName} ${alumni.maidenLastName}`,
      },
      "SIGNUP",
      "alumni_auth",
      alumni.id,
      { email: validated.email.trim().toLowerCase() },
      getIp(request)
    );

    return NextResponse.json({
      success: true,
      message: "ลงทะเบียนสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติบัญชีของท่าน",
    });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity, getIp } from "@/lib/activity-log";

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
    const { studentId, cohort, firstName, maidenLastName, birthDate, email, password } =
      body;

    // Validate all fields present
    if (
      !studentId ||
      !cohort ||
      !firstName ||
      !maidenLastName ||
      !birthDate ||
      !email ||
      !password
    ) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // Validate birthDate format: DDMMYYYY
    if (!/^\d{8}$/.test(birthDate)) {
      return NextResponse.json(
        { error: "รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น DDMMYYYY" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" },
        { status: 400 }
      );
    }

    // Validate password max length (prevent bcrypt DoS)
    if (password.length > 128) {
      return NextResponse.json(
        { error: "รหัสผ่านต้องไม่เกิน 128 ตัวอักษร" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "รูปแบบอีเมลไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    // Look up alumni matching all 5 identity fields
    const alumni = await prisma.alumni.findFirst({
      where: {
        studentId,
        cohort,
        firstName: { equals: firstName.trim(), mode: "insensitive" },
        maidenLastName: { equals: maidenLastName.trim(), mode: "insensitive" },
        birthDate,
      },
    });

    if (!alumni) {
      // No exact match — don't reject, let admin verify instead
      const existingByStudentId = await prisma.alumni.findUnique({
        where: { studentId },
      });

      if (existingByStudentId) {
        // Student ID exists but other details don't match
        if (existingByStudentId.passwordHash) {
          return NextResponse.json(
            { error: "ท่านได้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ" },
            { status: 409 }
          );
        }

        const passwordHash = await hashPassword(password);
        await prisma.alumni.update({
          where: { id: existingByStudentId.id },
          data: {
            passwordHash,
            email: email.trim().toLowerCase(),
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
          { email: email.trim().toLowerCase(), matchType: "studentId_only" },
          getIp(request)
        );

        return NextResponse.json({
          success: true,
          message: "ลงทะเบียนสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติบัญชีของท่าน",
        });
      }

      // No record at all — create new alumni for admin to verify
      const passwordHash = await hashPassword(password);
      const newAlumni = await prisma.alumni.create({
        data: {
          studentId,
          firstName: firstName.trim(),
          maidenLastName: maidenLastName.trim(),
          cohort,
          birthDate,
          prefix: "-",
          degreeLevel: "BACHELOR",
          email: email.trim().toLowerCase(),
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
        { email: email.trim().toLowerCase(), matchType: "new_record" },
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
    const passwordHash = await hashPassword(password);
    await prisma.alumni.update({
      where: { id: alumni.id },
      data: {
        passwordHash,
        email: email.trim().toLowerCase(),
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
      { email: email.trim().toLowerCase() },
      getIp(request)
    );

    return NextResponse.json({
      success: true,
      message: "ลงทะเบียนสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติบัญชีของท่าน",
    });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

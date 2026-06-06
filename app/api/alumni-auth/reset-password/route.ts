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

    const rateLimit = checkRateLimit(`reset-password:${ip}`);
    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
      return NextResponse.json(
        { error: "ลองส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่" },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
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

    if (password.length > 128) {
      return NextResponse.json(
        { error: "รหัสผ่านต้องไม่เกิน 128 ตัวอักษร" },
        { status: 400 }
      );
    }

    // Find valid reset token
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: { alumni: true },
    });

    if (
      !resetRecord ||
      resetRecord.used ||
      resetRecord.expiresAt < new Date()
    ) {
      return NextResponse.json(
        { error: "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว" },
        { status: 400 }
      );
    }

    // Hash new password and update in transaction
    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      // Update alumni password
      prisma.alumni.update({
        where: { id: resetRecord.alumniId },
        data: { passwordHash },
      }),
      // Mark reset token as used
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      }),
      // Invalidate all existing sessions for this alumni
      prisma.session.deleteMany({
        where: { alumniId: resetRecord.alumniId },
      }),
    ]);

    // Log activity
    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId: resetRecord.alumniId,
        alumniName: `${resetRecord.alumni.firstName} ${resetRecord.alumni.maidenLastName}`,
      },
      "PASSWORD_RESET_COMPLETE",
      "alumni_auth",
      resetRecord.alumniId,
      null,
      getIp(request)
    );

    return NextResponse.json({
      success: true,
      message: "รีเซ็ตรหัสผ่านสำเร็จ",
    });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

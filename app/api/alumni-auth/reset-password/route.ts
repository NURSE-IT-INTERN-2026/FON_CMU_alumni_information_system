import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity, getIp } from "@/lib/activity-log";
import { handleZodError, passwordField } from "@/lib/validations/helpers";

const resetPasswordApiSchema = z.object({
  token: z.string().min(1, "โทเคนไม่ถูกต้อง"),
  password: passwordField(),
});

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
    const validated = resetPasswordApiSchema.parse(body);

    // Find valid reset token
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token: validated.token },
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
    const passwordHash = await hashPassword(validated.password);

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
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

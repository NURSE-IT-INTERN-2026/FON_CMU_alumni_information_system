import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, passwordField } from "@/lib/validations/helpers";

const resetPasswordApiSchema = z
  .object({
    token: z.string().min(1, "โทเคนไม่ถูกต้อง"),
    password: passwordField(),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่าน"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
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

    // Defense in depth: only ACTIVE or REJECTED, non-suspended accounts may
    // reset. The forgot step already gates on this, but the account's status
    // may have changed between link issue and click. REJECTED accounts are
    // admitted (like the forgot step) because they still authenticate by
    // password on the re-sign-up (reapply) flow; resetting does NOT change
    // their accountStatus. The token holder is the account owner, so a
    // specific message is safe here.
    const status = resetRecord.alumni.accountStatus;
    if (
      (status !== "ACTIVE" && status !== "REJECTED") ||
      resetRecord.alumni.suspendedAt
    ) {
      return NextResponse.json(
        { error: "บัญชีนี้ไม่สามารถรีเซ็ตรหัสผ่านได้ กรุณาติดต่อผู้ดูแลระบบ" },
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
        alumniName: `${resetRecord.alumni.firstName} ${resetRecord.alumni.lastName}`,
      },
      "PASSWORD_RESET_COMPLETE",
      "alumni_auth",
      resetRecord.alumniId,
      null,
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

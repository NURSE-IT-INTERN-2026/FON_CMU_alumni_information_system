import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { bustCache } from "@/lib/cache";
import { handleZodError } from "@/lib/validations/helpers";
import { verifyEmailSchema } from "@/lib/validations/auth";

// Consumes an email-verification token: flips the alumni UNVERIFIED → PENDING
// (entering the admin-approval queue) and marks the token used. Mirrors the
// reset-password consume route.
export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0].trim() ??
      headerStore.get("x-real-ip") ??
      "unknown";

    const rateLimit = checkRateLimit(`verify-email:${ip}`);
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
    const validated = verifyEmailSchema.parse(body);

    const record = await prisma.emailVerification.findUnique({
      where: { token: validated.token },
      include: { alumni: true },
    });

    // Invalid if missing, already used, expired, or the account is no longer
    // UNVERIFIED (e.g. already verified or admin-acted).
    if (
      !record ||
      record.used ||
      record.expiresAt < new Date() ||
      record.alumni.accountStatus !== "UNVERIFIED"
    ) {
      return NextResponse.json(
        { error: "ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุแล้ว" },
        { status: 400 }
      );
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.alumni.update({
        where: { id: record.alumniId },
        data: { accountStatus: "PENDING", emailVerifiedAt: now },
      }),
      prisma.emailVerification.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);

    // The account just entered the admin pending-approvals queue — bust the
    // dashboard so the count is fresh.
    bustCache("dashboard");

    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId: record.alumniId,
        alumniName: `${record.alumni.firstName} ${record.alumni.lastName}`,
      },
      "EMAIL_VERIFY",
      "alumni_auth",
      record.alumniId,
      { email: record.alumni.email },
    );

    return NextResponse.json({
      success: true,
      message: "ยืนยันอีเมลสำเร็จ",
    });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

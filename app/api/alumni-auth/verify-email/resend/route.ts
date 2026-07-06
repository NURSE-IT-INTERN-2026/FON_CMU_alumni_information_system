import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { sendEmailVerificationEmail } from "@/lib/email";
import { handleZodError } from "@/lib/validations/helpers";
import { resendVerificationSchema } from "@/lib/validations/auth";

// Resends the email-verification email. Only acts on UNVERIFIED accounts;
// returns the same success message regardless (email-enumeration safe),
// mirroring the forgot-password route.
export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0].trim() ??
      headerStore.get("x-real-ip") ??
      "unknown";

    const rateLimit = checkRateLimit(`resend-verify:${ip}`);
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
    const validated = resendVerificationSchema.parse(body);

    const email = validated.email.trim().toLowerCase();

    // Always return the same message to prevent email enumeration
    const successMessage =
      "หากอีเมลนี้รอการยืนยันในระบบ ระบบจะส่งลิงก์ยืนยันไปยังอีเมลดังกล่าว";

    // Only resend for an UNVERIFIED account that still needs verification.
    const alumni = await prisma.alumni.findFirst({
      where: { email, accountStatus: "UNVERIFIED" },
    });

    if (!alumni || !alumni.email) {
      return NextResponse.json({ message: successMessage });
    }

    const verifyToken = randomBytes(32).toString("hex");
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Invalidate any prior unused tokens so only the latest link is valid.
    await prisma.emailVerification.updateMany({
      where: { alumniId: alumni.id, used: false },
      data: { used: true },
    });
    await prisma.emailVerification.create({
      data: { alumniId: alumni.id, token: verifyToken, expiresAt: verifyExpiresAt },
    });

    try {
      await sendEmailVerificationEmail(
        alumni.email,
        `${alumni.firstName} ${alumni.lastName}`,
        verifyToken,
      );
    } catch (err) {
      console.error("Failed to resend email-verification email:", err);
    }

    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId: alumni.id,
        alumniName: `${alumni.firstName} ${alumni.lastName}`,
      },
      "EMAIL_VERIFY_REQUEST",
      "alumni_auth",
      alumni.id,
      { email: alumni.email },
    );

    return NextResponse.json({ message: successMessage });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    // Return generic message even on error to prevent info leakage
    return NextResponse.json({
      message:
        "หากอีเมลนี้รอการยืนยันในระบบ ระบบจะส่งลิงก์ยืนยันไปยังอีเมลดังกล่าว",
    });
  }
}

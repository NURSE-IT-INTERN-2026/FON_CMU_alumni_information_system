import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity-log";
import { randomBytes } from "crypto";
import { handleZodError } from "@/lib/validations/helpers";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0].trim() ??
      headerStore.get("x-real-ip") ??
      "unknown";

    const rateLimit = checkRateLimit(`forgot-password:${ip}`);
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
    const validated = forgotPasswordSchema.parse(body);

    // Always return the same message to prevent email enumeration
    const successMessage =
      "หากอีเมลนี้ลงทะเบียนในระบบ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลดังกล่าว";

    // Look up an ACTIVE or REJECTED, non-suspended alumni by email who has a
    // password. ACTIVE accounts can log in; REJECTED accounts cannot log in but
    // still authenticate by password on the re-sign-up (reapply) flow — so a
    // reset is a live path for them too (resetting does NOT change their
    // accountStatus). Other statuses (UNVERIFIED/PENDING) never had a usable
    // password path, so they stay excluded. Enumeration-safe (same message below).
    const alumni = await prisma.alumni.findFirst({
      where: {
        email: validated.email.trim().toLowerCase(),
        passwordHash: { not: null },
        accountStatus: { in: ["ACTIVE", "REJECTED"] },
        suspendedAt: null,
      },
    });

    if (!alumni || !alumni.email) {
      // Return success message anyway to prevent enumeration
      return NextResponse.json({ message: successMessage });
    }

    // Generate reset token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any prior unused reset tokens so only the latest link is valid
    // (mirrors the verify-email/resend route).
    await prisma.passwordReset.updateMany({
      where: { alumniId: alumni.id, used: false },
      data: { used: true },
    });

    await prisma.passwordReset.create({
      data: {
        alumniId: alumni.id,
        token,
        expiresAt,
      },
    });

    // Best-effort send: a failure is logged but does NOT fail the request
    // (mirrors the verify-email/resend route).
    try {
      await sendPasswordResetEmail(alumni.email, token);
    } catch (err) {
      console.error("Failed to send password-reset email:", err);
    }

    // Log activity
    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId: alumni.id,
        alumniName: `${alumni.firstName} ${alumni.lastName}`,
      },
      "PASSWORD_RESET_REQUEST",
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
        "หากอีเมลนี้ลงทะเบียนในระบบ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลดังกล่าว",
    });
  }
}

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

    // Look up alumni by email who has a password (signed up)
    const alumni = await prisma.alumni.findFirst({
      where: {
        email: validated.email.trim().toLowerCase(),
        passwordHash: { not: null },
      },
    });

    if (!alumni || !alumni.email) {
      // Return success message anyway to prevent enumeration
      return NextResponse.json({ message: successMessage });
    }

    // Generate reset token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.create({
      data: {
        alumniId: alumni.id,
        token,
        expiresAt,
      },
    });

    // Send reset email
    await sendPasswordResetEmail(alumni.email, token);

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

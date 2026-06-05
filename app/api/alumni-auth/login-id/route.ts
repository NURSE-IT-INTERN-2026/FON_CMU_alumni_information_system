import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import prisma from "@/lib/prisma";
import { createAlumniSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0].trim() ??
      headerStore.get("x-real-ip") ??
      "unknown";

    const rateLimit = checkRateLimit(`alumni-login:${ip}`);
    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
      return NextResponse.json(
        { error: "ลองเข้าสู่ระบบมากเกินไป กรุณารอสักครู่แล้วลองใหม่" },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const { citizenId, birthDate } = body;

    if (!citizenId || !birthDate) {
      return NextResponse.json(
        { error: "กรุณากรอกเลขบัตรประชาชนและวันเกิด" },
        { status: 400 }
      );
    }

    // Validate citizenId: 13 digits
    if (!/^\d{13}$/.test(citizenId)) {
      return NextResponse.json(
        { error: "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก" },
        { status: 400 }
      );
    }

    // Validate birthDate: DDMMYYYY format (8 digits)
    if (!/^\d{8}$/.test(birthDate)) {
      return NextResponse.json(
        { error: "รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น DDMMYYYY" },
        { status: 400 }
      );
    }

    // Look up alumni by citizenId
    const alumni = await prisma.alumni.findUnique({
      where: { citizenId },
    });

    if (!alumni) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลของท่านในระบบ กรุณาติดต่อผู้ดูแลระบบ" },
        { status: 404 }
      );
    }

    // Verify birthDate matches
    if (alumni.birthDate !== birthDate) {
      return NextResponse.json(
        { error: "เลขบัตรประชาชนหรือวันเกิดไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // Create alumni session
    const isFirstLogin = !alumni.hasLoggedIn;
    const token = await createAlumniSession(alumni.id);

    // Update alumni login tracking
    await prisma.alumni.update({
      where: { id: alumni.id },
      data: {
        hasLoggedIn: true,
        lastLoginAt: new Date(),
      },
    });

    // Reset rate limit on success
    resetRateLimit(`alumni-login:${ip}`);

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set(setSessionCookie(token));

    return NextResponse.json({
      success: true,
      isFirstLogin,
      alumni: {
        id: alumni.id,
        prefix: alumni.prefix,
        firstName: alumni.firstName,
        maidenLastName: alumni.maidenLastName,
        newLastName: alumni.newLastName,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

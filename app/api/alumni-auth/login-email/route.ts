import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import prisma from "@/lib/prisma";
import {
  createAlumniSession,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { logActivity, getIp } from "@/lib/activity-log";

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
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "กรุณากรอกอีเมลและรหัสผ่าน" },
        { status: 400 }
      );
    }

    // Look up alumni by email
    const alumni = await prisma.alumni.findFirst({
      where: { email: email.trim().toLowerCase() },
    });

    if (!alumni) {
      return NextResponse.json(
        { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // Check if alumni has set up a password
    if (!alumni.passwordHash) {
      return NextResponse.json(
        { error: "ท่านยังไม่ได้ลงทะเบียน กรุณาลงทะเบียนก่อนเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, alumni.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // Check approval status
    if (alumni.approvalStatus === "REJECTED") {
      return NextResponse.json(
        { error: "บัญชีของท่านถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ" },
        { status: 403 }
      );
    }

    if (alumni.approvalStatus === "PENDING") {
      // Create session but redirect to pending page
      const token = await createAlumniSession(alumni.id);
      await prisma.alumni.update({
        where: { id: alumni.id },
        data: { hasLoggedIn: true, lastLoginAt: new Date() },
      });
      resetRateLimit(`alumni-login:${ip}`);
      const cookieStore = await cookies();
      cookieStore.set(setSessionCookie(token));

      return NextResponse.json({
        success: true,
        pendingApproval: true,
        redirect: "/alumni/pending",
      });
    }

    // Create alumni session (APPROVED)
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

    // Log activity
    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId: alumni.id,
        alumniName: `${alumni.firstName} ${alumni.maidenLastName}`,
      },
      "CREATE",
      "alumni_auth",
      alumni.id,
      { action: "login", method: "email" },
      getIp(request)
    );

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

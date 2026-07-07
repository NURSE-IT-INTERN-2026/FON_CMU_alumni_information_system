import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleZodError } from "@/lib/validations/helpers";

// Step 1 of re-apply: prove identity (email + password) and return the
// account's current editable fields so the re-apply form can be pre-filled.
// Only acts on REJECTED accounts. The final submit (../route.ts) re-verifies
// the password, so no token/session is issued here.

const prepareSchema = z.object({
  email: z.string().min(1, "กรุณากรอกอีเมล").email("รูปแบบอีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0].trim() ??
      headerStore.get("x-real-ip") ??
      "unknown";

    const rateLimit = checkRateLimit(`reapply:${ip}`);
    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
      return NextResponse.json(
        { error: "ลองยื่นคำขอใหม่มากเกินไป กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const { email, password } = prepareSchema.parse(await request.json());
    const normalizedEmail = email.trim().toLowerCase();

    const alumni = await prisma.alumni.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });
    // Generic 401 for not-found / no-credentials / wrong password.
    if (!alumni || !alumni.passwordHash) {
      return NextResponse.json(
        { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีไม่สามารถยื่นคำขอใหม่ได้" },
        { status: 401 }
      );
    }
    const valid = await verifyPassword(password, alumni.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีไม่สามารถยื่นคำขอใหม่ได้" },
        { status: 401 }
      );
    }
    if (alumni.accountStatus !== "REJECTED") {
      return NextResponse.json(
        { error: "บัญชีของท่านยังไม่ถูกปฏิเสธ จึงไม่สามารถยื่นคำขอใหม่ได้" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      fields: {
        studentId: alumni.studentId,
        degreeLevel: alumni.degreeLevel,
        cohort: alumni.cohort ?? "",
        firstName: alumni.firstName,
        lastName: alumni.lastName,
        birthDate: alumni.birthDate ?? "",
        email: alumni.email ?? normalizedEmail,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/alumni-auth/reapply/prepare error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}

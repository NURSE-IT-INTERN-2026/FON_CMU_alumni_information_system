import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity, getIp } from "@/lib/activity-log";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";

const RATE_LIMIT_MAX = 300;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  // 1. Auth check
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  // 2. Rate limit
  const ip = getIp(request);
  const rateResult = checkRateLimit(
    `cmu-alumni:${ip}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW,
  );
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateResult.retryAfterMs / 1000)) },
      },
    );
  }

  try {
    // 3. Extract and validate studentId
    const { studentId } = await params;

    if (!/^\d{5,15}$/.test(studentId)) {
      return NextResponse.json(
        { error: "รหัสนักศึกษาไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    // 4. Fetch from CMU Registrar API
    const graduate = await fetchCmuGraduateById(studentId);

    if (!graduate) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่าคณะพยาบาลศาสตร์" },
        { status: 404 },
      );
    }

    // 5. Log activity
    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "cmu_alumni",
      studentId,
      { action: "lookup" },
      ip,
    );

    return NextResponse.json({ data: graduate });
  } catch (error) {
    console.error("GET /api/cmu-alumni/[studentId] error:", error);

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "ระบบทะเบียนมหาวิทยาลัยไม่ตอบสนอง กรุณาลองใหม่ภายหลัง" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลศิษย์เก่าจากระบบทะเบียน" },
      { status: 500 },
    );
  }
}

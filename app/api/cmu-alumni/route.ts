import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity, getIp } from "@/lib/activity-log";
import { fetchCmuGraduates, type CmuGraduate } from "@/lib/cmu-registrar";
import { PAGE_SIZE } from "@/lib/constants";

const RATE_LIMIT_MAX = 300;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

export async function GET(request: NextRequest) {
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
    // 3. Parse query params
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      1,
      Math.min(100, parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10)),
    );
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    // 4. Fetch from CMU Registrar API
    const graduates = await fetchCmuGraduates();

    // 5. Apply search filter
    let filtered = graduates;
    if (search) {
      filtered = graduates.filter((g: CmuGraduate) => {
        const haystack = [
          g.name_th,
          g.surname_th,
          g.student_id,
          g.name_en,
          g.surname_en,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    // 6. Paginate
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    // 7. Log activity
    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "EXPORT",
      "cmu_alumni",
      null,
      { action: "list", resultCount: total, search: search || undefined },
      ip,
    );

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("GET /api/cmu-alumni error:", error);

    // Distinguish timeout vs other errors
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

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// "unverified" is intentionally NOT a filter — UNVERIFIED accounts are a
// transient pre-email-verification state that admins don't track, so they're
// excluded from this list entirely (see the base `where` below).
const STATUS_FILTERS = new Set(["pending", "active", "rejected"]);

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const search = searchParams.get("search") || "";
    const status = (searchParams.get("status") || "").toLowerCase();

    // Any alumni with credentials is an account — but UNVERIFIED (signed up,
    // not yet email-confirmed) is a transient state admins don't track, so it's
    // excluded from this list (PENDING / ACTIVE / REJECTED only).
    // (Previously gated on `hasLoggedIn`, which skipped not-yet-approved signups.)
    const where: Record<string, unknown> = {
      passwordHash: { not: null },
      deletedAt: null,
      accountStatus: { not: "UNVERIFIED" },
    };

    if (STATUS_FILTERS.has(status)) {
      where.accountStatus = status.toUpperCase();
    }

    if (search) {
      where.OR = [
        { studentId: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.alumni.findMany({
        where,
        // Newest first so fresh pending signups surface at the top.
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          studentId: true,
          prefix: true,
          firstName: true,
          lastName: true,
          cohort: true,
          degreeLevel: true,
          email: true,
          contactEmail: true,
          phones: true,
          lastLoginAt: true,
          suspendedAt: true,
          accountStatus: true,
          createdAt: true,
          signupVerification: true,
        },
      }),
      prisma.alumni.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    console.error("GET /api/alumni-accounts error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
}

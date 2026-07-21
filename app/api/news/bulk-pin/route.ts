import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

// Bulk-pin published news articles into the "ประชาสัมพันธ์สำคัญ" section. Admin-only.
// `status: "PUBLISHED"` is defense-in-depth (only published news may be pinned,
// matching POST /api/news/[id]/pin). `pinnedAt: null` makes already-pinned items
// in the selection a TRUE no-op (their timestamp isn't refreshed → the pinned
// section order is preserved). Pin-only; bulk-unpin is a separate follow-up.
export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเลือกรายการที่ต้องการปักหมุด" },
        { status: 400 },
      );
    }
    if (ids.length > 1000) {
      return NextResponse.json(
        { error: "ไม่สามารถปักหมุดเกิน 1000 รายการในครั้งเดียว" },
        { status: 400 },
      );
    }
    const result = await prisma.news.updateMany({
      where: { id: { in: ids }, status: "PUBLISHED", pinnedAt: null },
      data: { pinnedAt: new Date() },
    });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "news",
        null,
        { bulk: "pin", count: result.count, ids },
      );
    }

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Bulk pin error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการปักหมุดข้อมูล" },
      { status: 500 },
    );
  }
}

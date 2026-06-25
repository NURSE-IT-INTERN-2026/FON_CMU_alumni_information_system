import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkSuperAdminPermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

/**
 * POST /api/logs/bulk-delete — permanently delete activity-log entries.
 * Superadmin-only (irreversible). Hard-deletes (ActivityLog has no soft-delete
 * column) and writes ONE trace row (BULK_DELETE / activity_log, details {count})
 * so deletions stay accountable.
 */
export async function POST(request: NextRequest) {
  const permErr = await checkSuperAdminPermission();
  if (permErr) return permErr;
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเลือกรายการที่ต้องการลบ" },
        { status: 400 }
      );
    }
    if (ids.length > 1000) {
      return NextResponse.json(
        { error: "ไม่สามารถลบเกิน 1000 รายการในครั้งเดียว" },
        { status: 400 }
      );
    }

    const result = await prisma.activityLog.deleteMany({
      where: { id: { in: ids } },
    });

    // Accountability trace (never blocks the request).
    const session = await getSession();
    if (session) {
      await logActivity(
        {
          actorType: "ADMIN",
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: session.user.role,
        },
        "BULK_DELETE",
        "activity_log",
        null,
        { count: result.count }
      );
    }

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Bulk delete logs error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบข้อมูล" },
      { status: 500 }
    );
  }
}

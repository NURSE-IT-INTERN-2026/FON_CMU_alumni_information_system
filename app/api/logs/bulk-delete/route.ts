import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkSuperAdminPermission } from "@/lib/permissions";

/**
 * POST /api/logs/bulk-delete — permanently delete activity-log entries.
 * Superadmin-only (irreversible). Hard-deletes (ActivityLog has no soft-delete
 * column). Deliberately does NOT log the deletion itself — leaving a trace would
 * defeat the purpose of removing log entries.
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

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Bulk delete logs error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบข้อมูล" },
      { status: 500 }
    );
  }
}

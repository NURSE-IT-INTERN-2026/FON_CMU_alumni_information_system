import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

// Toggle the pin on each selected published news article (pin the unpinned,
// unpin the pinned). Admin-only. One click performs BOTH: this is what powers
// the adaptive "ปักหมุด/เลิกปักหมุดที่เลือก" button when the selection mixes pinned
// and unpinned items.
//
// Toggling can't be a single updateMany — a second `pinnedAt: null` filter would
// re-pin what a first just unpinned. So read each item's current pinnedAt, partition
// into disjoint to-pin / to-unpin id sets, and run two updateMany inside a
// $transaction. `status: "PUBLISHED"` is defense-in-depth (only published news may
// be pinned, matching POST /api/news/[id]/pin); the client's status-lock already
// restricts the ids to PUBLISHED.
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

    const now = new Date();
    const { pinned, unpinned } = await prisma.$transaction(async (tx) => {
      const items = await tx.news.findMany({
        where: { id: { in: ids }, status: "PUBLISHED" },
        select: { id: true, pinnedAt: true },
      });
      const toPin = items.filter((i) => !i.pinnedAt).map((i) => i.id);
      const toUnpin = items.filter((i) => i.pinnedAt).map((i) => i.id);
      const [pinResult, unpinResult] = await Promise.all([
        toPin.length ? tx.news.updateMany({ where: { id: { in: toPin } }, data: { pinnedAt: now } }) : Promise.resolve({ count: 0 }),
        toUnpin.length ? tx.news.updateMany({ where: { id: { in: toUnpin } }, data: { pinnedAt: null } }) : Promise.resolve({ count: 0 }),
      ]);
      return { pinned: pinResult.count, unpinned: unpinResult.count };
    });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "news",
        null,
        { bulk: "pin", pinned, unpinned, ids },
      );
    }

    return NextResponse.json({ pinned, unpinned });
  } catch (error) {
    console.error("Bulk pin toggle error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการปักหมุดข้อมูล" },
      { status: 500 },
    );
  }
}

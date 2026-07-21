import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

// Bulk-publish news articles (DRAFT/DISCONTINUED → PUBLISHED). Admin-only.
// The `status in (DRAFT, DISCONTINUED)` filter is defense-in-depth (the client's
// status-group selection gate already restricts the ids) AND matches the
// single-entity PUT semantics: publishedAt is stamped on any non-PUBLISHED→PUBLISHED
// transition. Idempotent on already-published ids (they're filtered out).
export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเลือกรายการที่ต้องการเผยแพร่" },
        { status: 400 },
      );
    }
    if (ids.length > 1000) {
      return NextResponse.json(
        { error: "ไม่สามารถเผยแพร่เกิน 1000 รายการในครั้งเดียว" },
        { status: 400 },
      );
    }
    const result = await prisma.news.updateMany({
      where: { id: { in: ids }, status: { in: ["DRAFT", "DISCONTINUED"] } },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "news",
        null,
        { bulk: "publish", count: result.count, ids },
      );
    }

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Bulk publish error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการเผยแพร่ข้อมูล" },
      { status: 500 },
    );
  }
}

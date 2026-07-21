import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { computeFieldChanges, recordFieldChanges, TRACKED_FIELDS } from "@/lib/field-changes";

// Pin (or unpin) a news article so it surfaces in the "ประชาสัมพันธ์สำคัญ"
// section at the top of the news pages. Admin-only. `pinnedAt` doubles as the
// is-pinned flag (non-null ⇒ pinned); the regular list excludes pinned rows.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const pinned = body?.pinned === true;

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบข่าวสาร" }, { status: 404 });
    }

    // Only published news can be pinned — the card hides the pin button on
    // drafts/discontinued; this guard enforces the same rule at the API so the
    // rule can't be bypassed. Unpinning (`pinned: false`) stays allowed for any
    // status so stale pins can still be cleared.
    if (pinned && existing.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "ไม่สามารถปักหมุดข่าวที่ยังไม่เผยแพร่ได้" },
        { status: 400 }
      );
    }

    const news = await prisma.news.update({
      where: { id },
      data: { pinnedAt: pinned ? new Date() : null },
    });

    const changes = computeFieldChanges(existing, news, TRACKED_FIELDS.news);
    const logId = await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "UPDATE",
      "news",
      id,
      { changes },
    );
    await recordFieldChanges({
      resourceType: "news",
      resourceId: id,
      changes,
      actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email },
      activityLogId: logId,
    });

    return NextResponse.json({ success: true, pinnedAt: news.pinnedAt });
  } catch (error) {
    console.error("POST /api/news/[id]/pin error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการปักหมุดข่าวสาร" },
      { status: 500 }
    );
  }
}

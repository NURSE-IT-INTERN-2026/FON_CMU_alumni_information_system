import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, forumReportActionSchema } from "@/lib/validations";
import { emitNotification } from "@/lib/notification-emitter";

// Staff moderation action on a report: resolve or dismiss. Executive is blocked
// by checkWritePermission (read-only). Uses POST (not PUT/PATCH) for a discrete
// state transition, matching the bulk-action conventions elsewhere.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const permErr = await checkWritePermission();
    if (permErr) return permErr;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { id } = await params;
    const validated = forumReportActionSchema.parse(await request.json());

    const existing = await prisma.contentReport.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบรายงาน" }, { status: 404 });
    }

    const report = await prisma.contentReport.update({
      where: { id },
      data: {
        status: validated.action === "resolve" ? "RESOLVED" : "DISMISSED",
        resolvedBy: session.user.id,
        resolutionNote: validated.note ?? null,
      },
    });

    await logActivity(
      {
        actorType: "ADMIN",
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: session.user.role,
      },
      validated.action === "resolve" ? "RESOLVE" : "DISMISS",
      "content_report",
      id,
      { action: validated.action, resourceId: existing.resourceId, resourceType: existing.resourceType },
    );

    // Best-effort: tell the reporter the outcome.
    await emitNotification({
      alumniId: existing.reporterId,
      type: "REPORT_OUTCOME",
      outcome: validated.action === "resolve" ? "RESOLVED" : "DISMISSED",
    });

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/forum/reports/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดำเนินการ" }, { status: 500 });
  }
}

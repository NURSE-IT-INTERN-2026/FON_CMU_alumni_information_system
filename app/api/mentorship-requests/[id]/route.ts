import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { handleZodError, mentorshipActionSchema } from "@/lib/validations";
import { checkTransition, transitionResult } from "@/lib/mentorship-flow";
import { emitNotification } from "@/lib/notification-emitter";

/**
 * Act on a mentorship request: accept/decline (mentor only) or cancel
 * (mentee only, PENDING only). The ACCEPT response is the SINGLE place
 * contact info leaves the DB for mentorship — it carries the mentor's
 * `contactEmail`/`phones` so the mentee can reach out. Never selected in
 * any list endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;

    const { id } = await params;
    const { action } = mentorshipActionSchema.parse(await request.json());

    const req = await prisma.mentorshipRequest.findUnique({ where: { id } });
    if (!req) return NextResponse.json({ error: "ไม่พบคำขอ" }, { status: 404 });

    const check = checkTransition(
      req.status,
      action,
      req.mentorId === alumni.id,
      req.menteeId === alumni.id,
    );
    if (!check.ok) {
      // 403 for "not your request", 400 for "wrong state".
      const wrongParty = action === "cancel"
        ? req.menteeId !== alumni.id
        : req.mentorId !== alumni.id;
      return NextResponse.json(
        { error: check.error },
        { status: wrongParty ? 403 : 400 },
      );
    }

    const updated = await prisma.mentorshipRequest.update({
      where: { id },
      data: { status: transitionResult(action), respondedAt: new Date() },
    });
    await logActivity(
      alumniLogCtx(alumni),
      action === "accept" ? "APPROVE" : action === "decline" ? "REJECT" : "DELETE",
      "mentorship_request",
      id,
      { action },
    );

    // Best-effort: tell the other party (mentee hears accept/decline; the
    // mentor hears a cancel).
    await emitNotification({
      alumniId: action === "cancel" ? req.mentorId : req.menteeId,
      type: "MENTORSHIP_RESPONSE",
      entityId: id,
      skipAlumniId: alumni.id,
    });

    // The accept payload is the ONLY contact disclosure point.
    let mentorContact: { contactEmail: string | null; phones: string[] } | undefined;
    if (action === "accept") {
      const mentor = await prisma.alumni.findUnique({
        where: { id: alumni.id },
        select: { contactEmail: true, email: true, phones: true },
      });
      mentorContact = {
        contactEmail: mentor?.contactEmail ?? mentor?.email ?? null,
        phones: mentor?.phones ?? [],
      };
    }

    return NextResponse.json({ request: updated, ...(mentorContact ? { mentorContact } : {}) });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/mentorship-requests/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดำเนินการ" }, { status: 500 });
  }
}

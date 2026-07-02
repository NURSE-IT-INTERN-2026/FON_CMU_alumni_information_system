import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { sendSignupRejectedEmail } from "@/lib/email";
import { bustCache } from "@/lib/cache";

// Reject a pending signup → accountStatus REJECTED. The account is kept (visible
// behind the status filter, re-approvable) but blocked from login, and any
// active session is killed. Notifies the alumni by email on a real transition.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await checkWritePermission();
    if (denied) return denied;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;

    const alumni = await prisma.alumni.findUnique({ where: { id } });
    if (!alumni) {
      return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });
    }

    const wasRejected = alumni.accountStatus === "REJECTED";

    await prisma.alumni.update({
      where: { id },
      data: { accountStatus: "REJECTED" },
    });

    // End any active sessions so the block takes effect at once (PENDING
    // accounts shouldn't have any, but REJECT can also be re-applied to an
    // account that was since approved).
    await prisma.session.deleteMany({ where: { alumniId: id } });

    // The dashboard "pending approvals" card counts accountStatus — bust so it's
    // fresh right after a rejection.
    bustCache("dashboard");

    await logActivity(
      {
        actorType: "ADMIN",
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: session.user.role,
      },
      "REJECT",
      "alumni_auth",
      id,
      {
        alumniName: `${alumni.prefix}${alumni.firstName} ${alumni.lastName}`,
        studentId: alumni.studentId,
        reason,
      },
    );

    if (!wasRejected && alumni.email) {
      try {
        await sendSignupRejectedEmail(
          alumni.email,
          `${alumni.prefix}${alumni.firstName} ${alumni.lastName}`.trim(),
          reason,
        );
      } catch (err) {
        console.error("Failed to send signup-rejected email:", err);
      }
    }

    return NextResponse.json({ success: true, accountStatus: "REJECTED" });
  } catch (error) {
    console.error("POST /api/alumni-accounts/[id]/reject error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดำเนินการ" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

// Suspend (or reactivate) an alumni account. Suspending is a full block
// (PRD §3.15): the alumni can't log in and any existing session is killed
// immediately (getAlumniSession also rejects suspended accounts).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const suspend = body?.suspend === true;

    const alumni = await prisma.alumni.update({
      where: { id },
      data: { suspendedAt: suspend ? new Date() : null },
    });

    // End active sessions on suspend so the block takes effect at once.
    if (suspend) {
      await prisma.session.deleteMany({ where: { alumniId: id } });
    }

    await logActivity(
      {
        actorType: "ADMIN",
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: session.user.role,
      },
      suspend ? "SUSPEND" : "RESTORE",
      "alumni",
      id,
      {
        alumniName: `${alumni.prefix}${alumni.firstName} ${alumni.lastName}`,
      },
    );

    return NextResponse.json({ success: true, suspendedAt: alumni.suspendedAt });
  } catch (error) {
    console.error("POST /api/alumni-accounts/[id]/suspend error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดำเนินการ" },
      { status: 500 }
    );
  }
}

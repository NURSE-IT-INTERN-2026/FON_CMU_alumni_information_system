import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    if (session.user.role === "executive") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ดำเนินการ" }, { status: 403 });
    }

    const body = await request.json();
    const { alumniId } = body;

    if (!alumniId) {
      return NextResponse.json({ error: "กรุณาระบุรหัสศิษย์เก่า" }, { status: 400 });
    }

    const alumni = await prisma.alumni.findUnique({ where: { id: alumniId } });
    if (!alumni) {
      return NextResponse.json({ error: "ไม่พบข้อมูลศิษย์เก่า" }, { status: 404 });
    }

    if (alumni.approvalStatus !== "PENDING") {
      return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    }

    // Reject and also invalidate all sessions for this alumni
    await prisma.$transaction([
      prisma.alumni.update({
        where: { id: alumniId },
        data: { approvalStatus: "REJECTED" },
      }),
      prisma.session.deleteMany({
        where: { alumniId },
      }),
    ]);

    // Log activity
    await logActivity(
      {
        actorType: "ADMIN",
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: session.user.role,
      },
      "REJECT",
      "alumni_auth",
      alumniId,
      { studentId: alumni.studentId, name: `${alumni.firstName} ${alumni.maidenLastName}` },
      getIp(request)
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAlumniSession } from "@/lib/auth";

/**
 * Just the unread count (community V2) — drives the header bell badge. One
 * indexed count query; no TTL cache (per-user data defeats the shared map).
 */
export async function GET() {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const count = await prisma.notification.count({
      where: { alumniId: session.alumni.id, readAt: null },
    });
    return NextResponse.json({ count });
  } catch (error) {
    console.error("GET /api/notifications/unread-count error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

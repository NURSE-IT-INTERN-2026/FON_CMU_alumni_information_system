import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAlumniSession } from "@/lib/auth";

/**
 * Stamp the logged-in alum's announcements watermark (`announcementsLastReadAt
 * = now`) once they actually view the announcements list — this is what
 * clears the "ใหม่" badge. Idempotent, fire-and-forget (no logActivity —
 * not an audit-worthy action).
 */
export async function POST() {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    await prisma.alumni.update({
      where: { id: session.alumni.id },
      data: { announcementsLastReadAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/announcements/mark-read error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

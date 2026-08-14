import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAlumniSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, communityMembershipSchema } from "@/lib/validations";

// Operates on the LOGGED-IN alumni (mirrors /api/alumni-profile — identity comes
// from the session, never the body). The forum opt-in gate reads
// `Alumni.communityOptedInAt`: null = not a member (lib/forum-guard.ts).
export async function GET() {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    return NextResponse.json({
      alumniId: session.alumni.id,
      optedIn: session.alumni.communityOptedInAt !== null,
      optedInAt: session.alumni.communityOptedInAt,
      // The alum's cohort label — drives the groups page's cohort quick-join.
      cohort: session.alumni.cohort,
    });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const alumni = session.alumni;

    const body = await request.json();
    const { action } = communityMembershipSchema.parse(body);

    const optedIn = action === "opt-in";
    const updated = await prisma.alumni.update({
      where: { id: alumni.id },
      data: { communityOptedInAt: optedIn ? new Date() : null },
      select: { communityOptedInAt: true },
    });

    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId: alumni.id,
        alumniName: `${alumni.prefix}${alumni.firstName} ${alumni.lastName}`,
      },
      optedIn ? "OPT_IN" : "OPT_OUT",
      "community",
      alumni.id,
      { action },
    );

    return NextResponse.json({
      optedIn: updated.communityOptedInAt !== null,
      optedInAt: updated.communityOptedInAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST community-membership error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึก" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAlumniSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";

// Marks the logged-in alumni as having accepted the Terms of Service.
// The (authed) layout gates on `tosAcceptedAt`, so setting it here lets the
// alumni through to the profile.
export async function POST(request: Request) {
  const session = await getAlumniSession();
  if (!session || !session.alumni) {
    return NextResponse.json(
      { error: "กรุณาเข้าสู่ระบบ" },
      { status: 401 }
    );
  }

  const alumniId = session.alumni.id;

  await prisma.alumni.update({
    where: { id: alumniId },
    data: { tosAcceptedAt: new Date() },
  });

  await logActivity(
    {
      actorType: "ALUMNI",
      alumniId,
      alumniName: `${session.alumni.prefix}${session.alumni.firstName} ${session.alumni.lastName}`,
    },
    "UPDATE",
    "alumni_auth",
    alumniId,
    { action: "accept_tos" },
    getIp(request)
  );

  return NextResponse.json({ success: true });
}

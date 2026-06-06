import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    // Only admin and superadmin can view pending alumni
    if (session.user.role === "executive") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
    }

    const pendingAlumni = await prisma.alumni.findMany({
      where: { approvalStatus: "PENDING" },
      orderBy: { updatedAt: "asc" },
      select: {
        id: true,
        studentId: true,
        prefix: true,
        firstName: true,
        maidenLastName: true,
        newLastName: true,
        cohort: true,
        degreeLevel: true,
        birthDate: true,
        cmuEmail: true,
        email: true,
        passwordHash: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(pendingAlumni);
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ" },
      { status: 500 }
    );
  }
}

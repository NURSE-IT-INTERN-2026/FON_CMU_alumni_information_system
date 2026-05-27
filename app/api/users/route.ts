import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity, getIp } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const users = await prisma.adminUser.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, email, role } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อ นามสกุล และอีเมล" },
        { status: 400 }
      );
    }

    if (!email.endsWith("@cmu.ac.th")) {
      return NextResponse.json(
        { error: "กรุณาใช้อีเมล @cmu.ac.th" },
        { status: 400 }
      );
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "อีเมลนี้มีอยู่ในระบบแล้ว" },
        { status: 409 }
      );
    }

    const user = await prisma.adminUser.create({
      data: {
        firstName,
        lastName,
        email,
        role: role || "admin",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (session) {
      await logActivity(
        { userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "CREATE",
        "user",
        user.id,
        { email: user.email, role: user.role },
        getIp(request)
      );
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("POST /api/users error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างผู้ใช้งาน" },
      { status: 500 }
    );
  }
}

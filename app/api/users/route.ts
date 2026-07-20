import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkNonExecutivePermission, checkSuperAdminPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, userCreateSchema } from "@/lib/validations";

export async function GET() {
  try {
    const permErr = await checkNonExecutivePermission();
    if (permErr) return permErr;

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
  const permErr = await checkSuperAdminPermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const body = await request.json();
    const validated = userCreateSchema.parse(body);

    if (!validated.email.endsWith("@cmu.ac.th")) {
      return NextResponse.json(
        { error: "กรุณาใช้อีเมล @cmu.ac.th" },
        { status: 400 }
      );
    }

    const existing = await prisma.adminUser.findUnique({ where: { email: validated.email } });
    if (existing) {
      return NextResponse.json(
        { error: "อีเมลนี้มีอยู่ในระบบแล้ว" },
        { status: 409 }
      );
    }

    const user = await prisma.adminUser.create({
      data: {
        firstName: validated.firstName,
        lastName: validated.lastName,
        email: validated.email,
        role: validated.role || "admin",
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
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "CREATE",
        "user",
        user.id,
        { email: user.email, role: user.role },
      );
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/users error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างผู้ใช้งาน" },
      { status: 500 }
    );
  }
}

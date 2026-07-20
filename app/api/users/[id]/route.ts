import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkNonExecutivePermission, checkSuperAdminPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { handleZodError, userUpdateSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const permErr = await checkNonExecutivePermission();
    if (permErr) return permErr;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.adminUser.findUnique({
      where: { id },
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

    if (!user) {
      return NextResponse.json(
        { error: "ไม่พบผู้ใช้งาน" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSuperAdminPermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = userUpdateSchema.parse(body);

    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบผู้ใช้งาน" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (validated.firstName !== undefined) updateData.firstName = validated.firstName;
    if (validated.lastName !== undefined) updateData.lastName = validated.lastName;
    if (validated.email !== undefined) updateData.email = validated.email;
    if (validated.role !== undefined) updateData.role = validated.role;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

    const user = await prisma.adminUser.update({
      where: { id },
      data: updateData,
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

    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "UPDATE",
      "user",
      id,
      { email: user.email, role: user.role },
    );

    // Suspend/activate: kill the user's sessions on suspend (full block) and
    // log a dedicated SUSPEND/RESTORE entry (PRD §3.15).
    if (validated.isActive !== undefined && validated.isActive !== existing.isActive) {
      if (validated.isActive === false) {
        await prisma.session.deleteMany({ where: { userId: id } });
      }
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        validated.isActive ? "RESTORE" : "SUSPEND",
        "user",
        id,
        { email: user.email, role: user.role },
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/users/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ใช้งาน" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkSuperAdminPermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบผู้ใช้งาน" },
        { status: 404 }
      );
    }

    await prisma.adminUser.delete({ where: { id } });

    await logActivity(
      { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
      "DELETE",
      "user",
      id,
      { email: existing.email, role: existing.role },
    );

    return NextResponse.json({ message: "ลบผู้ใช้งานสำเร็จ" });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบผู้ใช้งาน" },
      { status: 500 }
    );
  }
}

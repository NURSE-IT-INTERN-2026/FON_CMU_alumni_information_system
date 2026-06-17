import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";
import { handleZodError, alumniUpdateSchema } from "@/lib/validations";
import { TRACKED_FIELDS, computeFieldChanges, recordFieldChanges } from "@/lib/field-changes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const { id } = await params;

    const alumni = await prisma.alumni.findUnique({
      where: { id },
      include: {
        awards: true,
        associations: true,
        graduateCommittees: true,
        potentials: true,
        modelRepresentatives: true,
      },
    });

    if (!alumni) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    return NextResponse.json(alumni);
  } catch (error) {
    console.error("GET /api/alumni/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = alumniUpdateSchema.parse(body);

    const existing = await prisma.alumni.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(validated as Record<string, unknown>)) {
      // `reason` is a log-only field, not an Alumni column.
      if (value !== undefined && key !== "reason") {
        updateData[key] = value;
      }
    }

    if (updateData.studentId && updateData.studentId !== existing.studentId) {
      const duplicate = await prisma.alumni.findUnique({
        where: { studentId: updateData.studentId as string },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" },
          { status: 409 }
        );
      }
    }

    const alumni = await prisma.alumni.update({
      where: { id },
      data: updateData,
      include: {
        awards: true,
        associations: true,
        graduateCommittees: true,
        potentials: true,
        modelRepresentatives: true,
      },
    });

    const changes = computeFieldChanges(existing, alumni, TRACKED_FIELDS.alumni);
    const session = await getSession();
    if (session) {
      await recordFieldChanges({ resourceType: "alumni", resourceId: id, changes, actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email }, reason: validated.reason });
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "alumni",
        id,
        { changes },
        getIp(request),
        validated.reason
      );
    }

    return NextResponse.json(alumni);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/alumni/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;

    const existing = await prisma.alumni.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    await prisma.alumni.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "DELETE",
        "alumni",
        id,
        { studentId: existing.studentId, name: `${existing.prefix}${existing.firstName} ${existing.maidenLastName}` },
        getIp(request)
      );
    }

    return NextResponse.json({ message: "ลบข้อมูลศิษย์เก่าสำเร็จ" });
  } catch (error) {
    console.error("DELETE /api/alumni/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

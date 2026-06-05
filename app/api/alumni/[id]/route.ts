import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";

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

    const existing = await prisma.alumni.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    if (body.studentId && body.studentId !== existing.studentId) {
      const duplicate = await prisma.alumni.findUnique({
        where: { studentId: body.studentId },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "รหัสนักศึกษานี้มีอยู่ในระบบแล้ว" },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "studentId",
      "prefix",
      "firstName",
      "maidenLastName",
      "cohort",
      "degreeLevel",
      "newLastName",
      "province",
      "email",
      "phone",
      "currentWorkplace",
      "country",
      "isPotential",
      "isModelRepresentative",
      "photoUrl",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
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

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "alumni",
        id,
        { studentId: alumni.studentId, name: `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}` },
        getIp(request)
      );
    }

    return NextResponse.json(alumni);
  } catch (error) {
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

    await prisma.alumni.delete({ where: { id } });

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

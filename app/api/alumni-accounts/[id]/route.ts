import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    if (session.user.role === "executive") {
      return NextResponse.json(
        { error: "คุณไม่มีสิทธิ์ดำเนินการนี้" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const alumni = await prisma.alumni.findUnique({ where: { id } });

    if (!alumni) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    return NextResponse.json(alumni);
  } catch (error) {
    console.error("GET /api/alumni-accounts/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    if (session.user.role === "executive") {
      return NextResponse.json(
        { error: "คุณไม่มีสิทธิ์ดำเนินการนี้" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Admin can edit all alumni fields
    const allowedFields = [
      "prefix", "firstName", "maidenLastName", "newLastName",
      "cohort", "degreeLevel", "province", "email", "phone",
      "currentWorkplace", "country", "citizenId", "birthDate",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "ไม่มีข้อมูลที่จะอัปเดต" },
        { status: 400 }
      );
    }

    // Set adminEditedAt timestamp to trigger alumni notification
    updateData.adminEditedAt = new Date();

    const alumni = await prisma.alumni.update({
      where: { id },
      data: updateData,
    });

    // Log admin edit of alumni profile
    const ip = getIp(request);
    await logActivity(
      {
        actorType: "ADMIN",
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: session.user.role,
      },
      "UPDATE",
      "alumni_profile",
      alumni.id,
      { updatedFields: Object.keys(updateData), source: "admin_edit" },
      ip
    );

    return NextResponse.json(alumni);
  } catch (error) {
    console.error("PUT /api/alumni-accounts/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" },
      { status: 500 }
    );
  }
}

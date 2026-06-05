import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAlumniSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";

const ALUMNI_EDITABLE_FIELDS = [
  "prefix",
  "firstName",
  "maidenLastName",
  "newLastName",
  "cohort",
  "degreeLevel",
  "province",
  "email",
  "phone",
  "currentWorkplace",
  "country",
] as const;

export async function GET() {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    const alumni = await prisma.alumni.findUnique({
      where: { id: session.alumni.id },
    });

    if (!alumni) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    return NextResponse.json(alumni);
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getAlumniSession();
    if (!session || !session.alumni) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบ" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Only allow editing specific fields
    const updateData: Record<string, unknown> = {};
    for (const field of ALUMNI_EDITABLE_FIELDS) {
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

    const alumni = await prisma.alumni.update({
      where: { id: session.alumni.id },
      data: updateData,
    });

    // Log alumni profile edit
    const ip = getIp(request);
    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId: alumni.id,
        alumniName: `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
      },
      "UPDATE",
      "alumni_profile",
      alumni.id,
      { updatedFields: Object.keys(updateData), source: "alumni_self_edit" },
      ip
    );

    return NextResponse.json(alumni);
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" },
      { status: 500 }
    );
  }
}

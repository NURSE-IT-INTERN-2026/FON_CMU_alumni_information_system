import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const alumni = await prisma.alumni.findUnique({
      where: { id },
      include: {
        awards: true,
        associationMembers: true,
        graduateCommittees: true,
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
      "firstName",
      "lastName",
      "degreeLevel",
      "email",
      "phone",
      "currentWorkplace",
      "country",
      "isPotential",
      "isModelRepresentative",
      "expertise",
      "achievementSummary",
      "photoUrl",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.initialYear !== undefined) {
      updateData.initialYear = parseInt(String(body.initialYear), 10);
    }
    if (body.graduationYear !== undefined) {
      updateData.graduationYear = parseInt(String(body.graduationYear), 10);
    }

    const alumni = await prisma.alumni.update({
      where: { id },
      data: updateData,
      include: {
        awards: true,
        associationMembers: true,
        graduateCommittees: true,
      },
    });

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

    return NextResponse.json({ message: "ลบข้อมูลศิษย์เก่าสำเร็จ" });
  } catch (error) {
    console.error("DELETE /api/alumni/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบข้อมูลศิษย์เก่า" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { id } = await params;
    const body = await request.json();
    const { studentId, recipientName, awardName, awardType, year, description } = body;

    if (!awardName || !awardType || !year) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const award = await prisma.award.update({
      where: { id },
      data: {
        studentId: studentId || null,
        recipientName: recipientName?.trim() || null,
        awardName: awardName.trim(),
        awardType,
        year: Number(year),
        description: description?.trim() || null,
      },
      include: {
        alumni: { select: { prefix: true, firstName: true, maidenLastName: true } },
      },
    });

    const session = await getSession();
    if (session) {
      await logActivity(
        { userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "UPDATE",
        "award",
        id,
        { awardName: award.awardName, awardType: award.awardType, year: award.year },
        getIp(request)
      );
    }

    return NextResponse.json(award);
  } catch (error) {
    console.error("Failed to update award:", error);
    return NextResponse.json(
      { error: "Failed to update award" },
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
    await prisma.award.delete({ where: { id } });

    const session = await getSession();
    if (session) {
      await logActivity(
        { userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "DELETE",
        "award",
        id,
        null,
        getIp(request)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete award:", error);
    return NextResponse.json(
      { error: "Failed to delete award" },
      { status: 500 }
    );
  }
}

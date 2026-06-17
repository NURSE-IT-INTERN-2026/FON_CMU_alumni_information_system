import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "กรุณาเลือกรายการที่ต้องการลบ" },
        { status: 400 }
      );
    }
    if (ids.length > 1000) {
      return NextResponse.json(
        { error: "ไม่สามารถลบเกิน 1000 รายการในครั้งเดียว" },
        { status: 400 }
      );
    }
    const result = await prisma.alumniAgency.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบข้อมูล" },
      { status: 500 }
    );
  }
}

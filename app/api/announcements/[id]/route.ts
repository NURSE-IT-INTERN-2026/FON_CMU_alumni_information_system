import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { adminLogCtx } from "@/lib/event-guard";
import { bangkokDatetimeLocalToIso } from "@/lib/event-format";
import { handleZodError, announcementUpdateSchema } from "@/lib/validations";

/**
 * One staff announcement. GET = broadcast read. PUT/DELETE = staff only
 * (`checkWritePermission` — executive read-only). DELETE is a soft-delete
 * (`announcement` in TRASH_ENTITIES). Setting `pinned` toggles `pinnedAt`;
 * `expiresAt: null` clears the expiry.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await getSession();
    if (!staff) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const { id } = await params;
    const announcement = await prisma.announcement.findFirst({ where: { id } });
    if (!announcement) return NextResponse.json({ error: "ไม่พบประกาศ" }, { status: 404 });
    return NextResponse.json(announcement);
  } catch (error) {
    console.error("GET /api/announcements/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await getSession();
    if (!staff) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const permErr = await checkWritePermission();
    if (permErr) return permErr;

    const { id } = await params;
    const existing = await prisma.announcement.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "ไม่พบประกาศ" }, { status: 404 });

    const v = announcementUpdateSchema.parse(await request.json());
    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        ...(v.title !== undefined ? { title: v.title } : {}),
        ...(v.body !== undefined ? { body: v.body } : {}),
        ...(v.pinned !== undefined ? { pinnedAt: v.pinned ? (existing.pinnedAt ?? new Date()) : null } : {}),
        ...(v.expiresAt !== undefined
          ? { expiresAt: v.expiresAt ? new Date(bangkokDatetimeLocalToIso(v.expiresAt)) : null }
          : {}),
      },
    });

    await logActivity(adminLogCtx(staff), "UPDATE", "announcement", id, { title: announcement.title });
    return NextResponse.json(announcement);
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/announcements/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึก" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await getSession();
    if (!staff) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const permErr = await checkWritePermission();
    if (permErr) return permErr;

    const { id } = await params;
    const existing = await prisma.announcement.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "ไม่พบประกาศ" }, { status: 404 });

    await prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
    await logActivity(adminLogCtx(staff), "DELETE", "announcement", id, { title: existing.title });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/announcements/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบ" }, { status: 500 });
  }
}

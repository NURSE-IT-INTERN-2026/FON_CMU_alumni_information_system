import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { resolveEventStaffOrAlumni, adminLogCtx, alumniLogCtx } from "@/lib/event-guard";
import { canDeleteEventPhoto } from "@/lib/event-photo-gate";

/**
 * Delete one event photo (soft-delete; uploader or staff). Uploader path
 * checks the alumni session directly so deleting stays possible after
 * opt-out (mirrors forum content rules).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const who = await resolveEventStaffOrAlumni();
    if ("error" in who) return who.error;

    const { photoId } = await params;
    const photo = await prisma.eventPhoto.findFirst({ where: { id: photoId, deletedAt: null } });
    if (!photo) return NextResponse.json({ error: "ไม่พบรูปภาพ" }, { status: 404 });

    if (who.staff) {
      const permErr = await checkWritePermission();
      if (permErr) return permErr;
    } else if (!canDeleteEventPhoto({ isStaff: false, alumniId: who.alumni!.id, uploaderAlumniId: photo.uploaderAlumniId })) {
      return NextResponse.json({ error: "คุณไม่สามารถลบรูปภาพของผู้อื่นได้" }, { status: 403 });
    }

    await prisma.eventPhoto.update({ where: { id: photoId }, data: { deletedAt: new Date() } });

    const actor = who.staff ? adminLogCtx(who.staff) : alumniLogCtx(who.alumni!);
    await logActivity(actor, "DELETE", "event_photo", photoId, {
      eventId: photo.eventId,
      ...(who.staff ? { moderation: true } : {}),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/events/[id]/photos/[photoId] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบรูปภาพ" }, { status: 500 });
  }
}

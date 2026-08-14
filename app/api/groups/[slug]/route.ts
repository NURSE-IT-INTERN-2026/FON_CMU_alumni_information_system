import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { checkWritePermission } from "@/lib/permissions";
import { resolveGroupReader, loadGroup, findMembership, alumniLogCtx } from "@/lib/group-guard";
import { adminLogCtx } from "@/lib/event-guard";
import { handleZodError, groupUpdateSchema } from "@/lib/validations";

/**
 * One community V2 group (param = slug or id). GET = detail + the caller's
 * membership role. PUT/DELETE = manage (staff via checkWritePermission, or a
 * MODERATOR member). COHORT groups are auto-derived — they can be deleted by
 * staff (regenerates lazily) but not edited.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const reader = await resolveGroupReader();
    if ("error" in reader) return reader.error;

    const found = await loadGroup((await params).slug);
    if ("error" in found) return found.error;

    const membership = await findMembership(found.group.id, reader.alumni?.id);

    return NextResponse.json({
      group: found.group,
      isMember: !!membership,
      myRole: membership?.role ?? null,
    });
  } catch (error) {
    console.error("GET /api/groups/[slug] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่ม" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const reader = await resolveGroupReader();
    if ("error" in reader) return reader.error;

    const found = await loadGroup((await params).slug);
    if ("error" in found) return found.error;
    const group = found.group;

    if (reader.staff) {
      const permErr = await checkWritePermission();
      if (permErr) return permErr;
    } else {
      const membership = await findMembership(group.id, reader.alumni!.id);
      if (membership?.role !== "MODERATOR") {
        return NextResponse.json(
          { error: "เฉพาะผู้ดูแลกลุ่มหรือเจ้าหน้าที่เท่านั้นที่แก้ไขกลุ่มได้" },
          { status: 403 },
        );
      }
    }

    if (group.kind === "COHORT") {
      return NextResponse.json(
        { error: "กลุ่มรุ่นสร้างอัตโนมัติจากข้อมูลรุ่น ไม่สามารถแก้ไขได้" },
        { status: 400 },
      );
    }

    const v = groupUpdateSchema.parse(await request.json());
    const updated = await prisma.communityGroup.update({
      where: { id: group.id },
      data: {
        ...(v.title !== undefined ? { title: v.title } : {}),
        ...(v.description !== undefined ? { description: v.description } : {}),
      },
    });

    const actor = reader.staff ? adminLogCtx(reader.staff) : alumniLogCtx(reader.alumni!);
    await logActivity(actor, "UPDATE", "community_group", group.id, { title: updated.title });

    return NextResponse.json({ group: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/groups/[slug] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการแก้ไขกลุ่ม" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const reader = await resolveGroupReader();
    if ("error" in reader) return reader.error;

    const found = await loadGroup((await params).slug);
    if ("error" in found) return found.error;
    const group = found.group;

    if (reader.staff) {
      const permErr = await checkWritePermission();
      if (permErr) return permErr;
    } else {
      const membership = await findMembership(group.id, reader.alumni!.id);
      if (membership?.role !== "MODERATOR") {
        return NextResponse.json(
          { error: "เฉพาะผู้ดูแลกลุ่มหรือเจ้าหน้าที่เท่านั้นที่ลบกลุ่มได้" },
          { status: 403 },
        );
      }
    }

    await prisma.communityGroup.update({
      where: { id: group.id },
      data: { deletedAt: new Date() },
    });

    const actor = reader.staff ? adminLogCtx(reader.staff) : alumniLogCtx(reader.alumni!);
    await logActivity(actor, "DELETE", "community_group", group.id, { title: group.title });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/groups/[slug] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบกลุ่ม" }, { status: 500 });
  }
}

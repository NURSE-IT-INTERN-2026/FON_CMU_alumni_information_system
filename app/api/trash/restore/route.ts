import { NextRequest, NextResponse } from "next/server";
import { checkSuperAdminPermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { TRASH_ENTITIES, getDelegate, buildDisplayName } from "@/lib/trash";

/** POST /api/trash/restore { entity, id } — un-soft-delete a record (superadmin only). */
export async function POST(request: NextRequest) {
  const permErr = await checkSuperAdminPermission();
  if (permErr) return permErr;
  try {
    const { entity, id } = await request.json();
    const cfg = TRASH_ENTITIES[entity];
    if (!cfg || !id) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
    const model = getDelegate(entity);
    const existing = await model.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบข้อมูล" }, { status: 404 });
    }
    await model.update({ where: { id }, data: { deletedAt: null } });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "RESTORE",
        cfg.resource,
        id,
        { entity, name: buildDisplayName(existing, cfg.nameFields) },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/trash/restore error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการกู้คืนข้อมูล" }, { status: 500 });
  }
}

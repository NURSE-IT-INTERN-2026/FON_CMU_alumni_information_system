import { NextRequest, NextResponse } from "next/server";
import { checkSuperAdminPermission } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { logActivity, getIp } from "@/lib/activity-log";
import { TRASH_ENTITIES, getDelegate, buildDisplayName } from "@/lib/trash";

/** POST /api/trash/hard-delete { entity, id, confirm } — permanently delete a soft-deleted record (superadmin only, requires confirm). */
export async function POST(request: NextRequest) {
  const permErr = await checkSuperAdminPermission();
  if (permErr) return permErr;
  try {
    const { entity, id, confirm } = await request.json();
    const cfg = TRASH_ENTITIES[entity];
    if (!cfg || !id) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
    if (confirm !== true) {
      return NextResponse.json({ error: "ต้องยืนยันการลบถาวร" }, { status: 400 });
    }
    const model = getDelegate(entity);
    const existing = await model.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบข้อมูล" }, { status: 404 });
    }
    const name = buildDisplayName(existing, cfg.nameFields);
    await model.delete({ where: { id } });

    const session = await getSession();
    if (session) {
      await logActivity(
        { actorType: "ADMIN", userId: session.user.id, userEmail: session.user.email, userRole: session.user.role },
        "HARD_DELETE",
        cfg.resource,
        id,
        { entity, name },
        getIp(request)
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/trash/hard-delete error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบข้อมูลถาวร" }, { status: 500 });
  }
}

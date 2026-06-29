import { NextRequest, NextResponse } from "next/server";
import { checkSuperAdminPermission } from "@/lib/permissions";
import { TRASH_ENTITIES, TRASH_PAGE_SIZE, getDelegate, buildDisplayName } from "@/lib/trash";

/** GET /api/trash?entity=&page=&search= — list soft-deleted records (superadmin only). */
export async function GET(request: NextRequest) {
  const permErr = await checkSuperAdminPermission();
  if (permErr) return permErr;

  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity") || "";
  const cfg = TRASH_ENTITIES[entity];
  if (!cfg) {
    return NextResponse.json({ error: "Entity ไม่ถูกต้อง" }, { status: 400 });
  }
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const search = searchParams.get("search") || "";
  const model = getDelegate(entity);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { deletedAt: { not: null } };
  if (search) {
    where.OR = cfg.nameFields.map((f) => ({ [f]: { contains: search, mode: "insensitive" } }));
  }

  try {
    const [records, total] = await Promise.all([
      model.findMany({
        where,
        orderBy: { deletedAt: "desc" },
        skip: (page - 1) * TRASH_PAGE_SIZE,
        take: TRASH_PAGE_SIZE,
      }),
      model.count({ where }),
    ]);
    return NextResponse.json({
      data: records.map((r: unknown) => {
        // Trash records are polymorphic (any soft-deletable model), so cast to
        // the minimal shape the listing needs rather than `any`.
        const rec = r as { id: string; deletedAt: Date | string | null };
        return {
          id: rec.id,
          deletedAt: rec.deletedAt,
          displayName: buildDisplayName(r, cfg.nameFields) || "(ไม่มีชื่อ)",
          snapshot: r as Record<string, unknown>,
        };
      }),
      total,
      page,
      pageSize: TRASH_PAGE_SIZE,
      totalPages: Math.ceil(total / TRASH_PAGE_SIZE),
      entity,
      label: cfg.label,
    });
  } catch (error) {
    console.error("GET /api/trash error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลที่ถูกลบ" }, { status: 500 });
  }
}

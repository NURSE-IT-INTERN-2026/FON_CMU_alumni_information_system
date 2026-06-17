import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Per-field change history (PRD §3.16).
//   GET ?resourceType=award&ids=id1,id2           → { [resourceId]: string[] } (fields with changes) — orange-cell highlighting
//   GET ?resourceType=award&resourceId=…&field=…  → [{ oldValue, newValue, actorName, reason, createdAt }] — history modal
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const resourceType = searchParams.get("resourceType");
  if (!resourceType) {
    return NextResponse.json({ error: "resourceType required" }, { status: 400 });
  }

  const idsParam = searchParams.get("ids");
  if (idsParam !== null) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({});
    const rows = await prisma.fieldChangeHistory.findMany({
      where: { resourceType, resourceId: { in: ids } },
      select: { resourceId: true, field: true },
      distinct: ["resourceId", "field"],
    });
    const map: Record<string, string[]> = {};
    for (const r of rows) {
      (map[r.resourceId] ||= []).push(r.field);
    }
    return NextResponse.json(map);
  }

  const resourceId = searchParams.get("resourceId");
  const field = searchParams.get("field");
  if (!resourceId || !field) {
    return NextResponse.json(
      { error: "resourceId and field required" },
      { status: 400 }
    );
  }

  const history = await prisma.fieldChangeHistory.findMany({
    where: { resourceType, resourceId, field },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(history);
}

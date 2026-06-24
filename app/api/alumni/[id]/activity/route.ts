import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Merged change timeline for one alumni (admin profile page "data logs" tab).
//   GET /api/alumni/[id]/activity
//
// `[id]` accepts the alumni UUID **or** its `studentId` (same resolution rule
// as GET /api/alumni/[id]). Returns a single `createdAt`-desc list combining:
//   - FieldChangeHistory for the alumni core record (`alumni` + `alumni_profile`)
//     and every related entity row (award/association/graduate_committee/
//     potential/model_representative/alumni_agency) this alumni owns.
//   - ActivityLog events tied to this alumni: alumni-self actions
//     (`alumniId`), admin direct-alumni edits (`resource="alumni"`) and any
//     event logged against one of this alumni's related rows (`resourceId`).
//
// Admin direct edits log with `resource="alumni", resourceId=<uuid>` and do
// NOT set `alumniId`, so both filters are required to be complete.

const MAX_ITEMS = 200;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Resolve alumni (id-or-studentId) and gather this alumni's related row ids.
    const alumni =
      (await prisma.alumni.findUnique({
        where: { id },
        select: {
          id: true,
          awards: { select: { id: true } },
          associations: { select: { id: true } },
          graduateCommittees: { select: { id: true } },
          potentials: { select: { id: true } },
          modelRepresentatives: { select: { id: true } },
          alumniAgency: { select: { id: true } },
        },
      })) ??
      (await prisma.alumni.findUnique({
        where: { studentId: id },
        select: {
          id: true,
          awards: { select: { id: true } },
          associations: { select: { id: true } },
          graduateCommittees: { select: { id: true } },
          potentials: { select: { id: true } },
          modelRepresentatives: { select: { id: true } },
          alumniAgency: { select: { id: true } },
        },
      }));

    if (!alumni) {
      return NextResponse.json({ error: "ไม่พบข้อมูลศิษย์เก่า" }, { status: 404 });
    }

    const awardIds = alumni.awards.map((r) => r.id);
    const assocIds = alumni.associations.map((r) => r.id);
    const committeeIds = alumni.graduateCommittees.map((r) => r.id);
    const potentialIds = alumni.potentials.map((r) => r.id);
    const modelRepIds = alumni.modelRepresentatives.map((r) => r.id);
    const agencyIds = alumni.alumniAgency.map((r) => r.id);
    const relatedIds = [
      ...awardIds,
      ...assocIds,
      ...committeeIds,
      ...potentialIds,
      ...modelRepIds,
      ...agencyIds,
    ];

    // Field-change clauses — only include a resource type if it has rows.
    const fieldClauses = [
      { resourceType: "alumni", resourceId: alumni.id },
      { resourceType: "alumni_profile", resourceId: alumni.id },
      { resourceType: "education", resourceId: alumni.id },
      ...(awardIds.length ? [{ resourceType: "award", resourceId: { in: awardIds } }] : []),
      ...(assocIds.length ? [{ resourceType: "association", resourceId: { in: assocIds } }] : []),
      ...(committeeIds.length ? [{ resourceType: "graduate_committee", resourceId: { in: committeeIds } }] : []),
      ...(potentialIds.length ? [{ resourceType: "potential", resourceId: { in: potentialIds } }] : []),
      ...(modelRepIds.length ? [{ resourceType: "model_representative", resourceId: { in: modelRepIds } }] : []),
      ...(agencyIds.length ? [{ resourceType: "alumni_agency", resourceId: { in: agencyIds } }] : []),
    ];

    const [fieldChanges, activityLogs] = await Promise.all([
      fieldClauses.length
        ? prisma.fieldChangeHistory.findMany({
            where: { OR: fieldClauses },
            orderBy: { createdAt: "desc" },
            take: MAX_ITEMS,
          })
        : Promise.resolve([]),
      prisma.activityLog.findMany({
        where: {
          OR: [
            { alumniId: alumni.id },
            { resource: "alumni", resourceId: alumni.id },
            ...(relatedIds.length ? [{ resourceId: { in: relatedIds } }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ITEMS,
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    // Field changes linked to each activity log (via activityLogId) — drives the
    // click-to-open changes modal. SYSTEM graduation logs link education fields.
    const activityIds = activityLogs.map((l) => l.id);
    const linkedChanges = activityIds.length
      ? await prisma.fieldChangeHistory.findMany({
          where: { activityLogId: { in: activityIds } },
          select: { activityLogId: true, field: true, oldValue: true, newValue: true },
          orderBy: { field: "asc" },
        })
      : [];
    const changesByLog = new Map<
      string,
      { field: string; oldValue: string | null; newValue: string | null }[]
    >();
    for (const c of linkedChanges) {
      if (!c.activityLogId) continue;
      const arr = changesByLog.get(c.activityLogId) ?? [];
      arr.push({ field: c.field, oldValue: c.oldValue, newValue: c.newValue });
      changesByLog.set(c.activityLogId, arr);
    }

    const fieldItems = fieldChanges.map((f) => ({
      kind: "field" as const,
      id: f.id,
      createdAt: f.createdAt,
      resourceType: f.resourceType,
      field: f.field,
      oldValue: f.oldValue,
      newValue: f.newValue,
      actorType: f.actorType,
      actorName: f.actorName,
      reason: f.reason,
    }));

    const activityItems = activityLogs.map((l) => {
      const actorName =
        l.actorType === "ALUMNI"
          ? l.alumniName
          : l.actorType === "SYSTEM"
            ? "ระบบ"
            : [l.user?.firstName, l.user?.lastName].filter(Boolean).join(" ") ||
              l.userEmail ||
              null;
      return {
        kind: "activity" as const,
        id: l.id,
        createdAt: l.createdAt,
        action: l.action,
        resource: l.resource,
        resourceId: l.resourceId,
        actorType: l.actorType,
        actorName,
        reason: l.reason,
        details: l.details,
        changes: changesByLog.get(l.id) ?? [],
      };
    });

    const items = [...fieldItems, ...activityItems]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, MAX_ITEMS);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/alumni/[id]/activity error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
}

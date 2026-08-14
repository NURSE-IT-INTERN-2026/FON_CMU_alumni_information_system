import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { loadGroup } from "@/lib/group-guard";
import { ensureCohortGroup, normalizeCohortKey } from "@/lib/group-cohort";
import { communityRateLimit, COMMUNITY_POST_LIMIT } from "@/lib/community-rate-limit";

/**
 * Join/leave a community V2 group. POST = join (idempotent — an existing
 * membership is a no-op). Joining by COHORT key (`{cohort: "พยบ. 25"}`)
 * lazily materializes the cohort group first. DELETE = leave. `memberCount`
 * is maintained inside the same `$transaction` as the row write.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;

    const rl = communityRateLimit(request, "post", COMMUNITY_POST_LIMIT);
    if (rl) return rl;

    const key = (await params).slug;
    // `cohort:<label>` slugs auto-create the group on first join.
    let group;
    if (key.startsWith("cohort:")) {
      const label = normalizeCohortKey(decodeURIComponent(key.slice("cohort:".length)));
      if (!alumni.cohort || normalizeCohortKey(alumni.cohort) !== label) {
        return NextResponse.json(
          { error: "เข้าร่วมกลุ่มรุ่นได้เฉพาะรุ่นของท่านเท่านั้น" },
          { status: 403 },
        );
      }
      group = await ensureCohortGroup(alumni.cohort);
    } else {
      const found = await loadGroup(key);
      if ("error" in found) return found.error;
      group = found.group;
    }

    const membership = await prisma.$transaction(async (tx) => {
      const existing = await tx.groupMembership.findUnique({
        where: { groupId_alumniId: { groupId: group.id, alumniId: alumni.id } },
      });
      if (existing) return { membership: existing, created: false };
      const created = await tx.groupMembership.create({
        data: { groupId: group.id, alumniId: alumni.id, role: "MEMBER" },
      });
      await tx.communityGroup.update({
        where: { id: group.id },
        data: { memberCount: { increment: 1 } },
      });
      return { membership: created, created: true };
    });

    if (membership.created) {
      await logActivity(
        alumniLogCtx(alumni),
        "CREATE",
        "group_membership",
        membership.membership.id,
        { groupId: group.id, groupTitle: group.title },
      );
    }

    return NextResponse.json(
      { membership: membership.membership, group: { id: group.id, slug: group.slug } },
      { status: membership.created ? 201 : 200 },
    );
  } catch (error) {
    console.error("POST /api/groups/[slug]/membership error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการเข้าร่วมกลุ่ม" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;

    const found = await loadGroup((await params).slug);
    if ("error" in found) return found.error;
    const group = found.group;

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.groupMembership.deleteMany({
        where: { groupId: group.id, alumniId: alumni.id },
      });
      if (deleted.count > 0) {
        await tx.communityGroup.update({
          where: { id: group.id },
          data: { memberCount: { decrement: deleted.count } },
        });
      }
      return deleted.count;
    });

    await logActivity(
      alumniLogCtx(alumni),
      "DELETE",
      "group_membership",
      null,
      { groupId: group.id, groupTitle: group.title },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/groups/[slug]/membership error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการออกจากกลุ่ม" }, { status: 500 });
  }
}

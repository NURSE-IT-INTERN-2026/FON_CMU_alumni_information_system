import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, getAlumniSession } from "@/lib/auth";
import { forumUnauthorized, forumNotOptedIn, alumniLogCtx } from "@/lib/forum-guard";
import type { Alumni, CommunityGroup, GroupMembership } from "@/app/generated/prisma/client";

/**
 * Server-only guards for community V2 groups. Composition rules:
 *
 * - READING a group (list, detail, its topics/events): staff OR any opted-in
 *   alum (`resolveGroupReader`) — all v2 groups are community-internal, so
 *   the forum opt-in gate is the entry requirement (no private groups in v2).
 * - WRITING group-scoped CONTENT (topics/events): an opted-in alum who is a
 *   MEMBER of that group (`requireGroupMember`). Staff are exempt from
 *   membership for moderation writes (they can post into / edit / delete any
 *   group's content, mirroring the forum).
 * - MANAGING the group itself (PUT/DELETE): staff OR a MODERATOR member.
 */

type AdminSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export async function resolveGroupReader(): Promise<
  { staff?: AdminSession; alumni?: Alumni } | { error: NextResponse }
> {
  const [staff, alumniSession] = await Promise.all([getSession(), getAlumniSession()]);
  if (staff) return { staff };
  if (!alumniSession || !alumniSession.alumni) return { error: forumUnauthorized() };
  if (!alumniSession.alumni.communityOptedInAt) return { error: forumNotOptedIn() };
  return { alumni: alumniSession.alumni };
}

/** Load a group by id-or-slug (not soft-deleted) or return a 404. */
export async function loadGroup(
  key: string,
): Promise<{ group: CommunityGroup } | { error: NextResponse }> {
  const group = await prisma.communityGroup.findFirst({
    where: {
      deletedAt: null,
      OR: [{ id: key }, { slug: key }],
    },
  });
  if (!group) {
    return {
      error: NextResponse.json({ error: "ไม่พบกลุ่มศิษย์เก่า" }, { status: 404 }),
    };
  }
  return { group };
}

/** The resolved alum's membership in this group (null for staff / non-members). */
export async function findMembership(
  groupId: string,
  alumniId: string | undefined,
): Promise<GroupMembership | null> {
  if (!alumniId) return null;
  return prisma.groupMembership.findUnique({
    where: { groupId_alumniId: { groupId, alumniId } },
  });
}

/**
 * A group writer = opted-in alum who is a member of the group. Staff are NOT
 * admitted (they never author alumni content — mirror of `requireForumAlumni`);
 * staff moderation goes through `resolveGroupReader` + `checkWritePermission`
 * at the route level instead.
 */
export async function requireGroupMember(
  groupId: string,
): Promise<{ alumni: Alumni } | { error: NextResponse }> {
  const session = await getAlumniSession();
  if (!session || !session.alumni) return { error: forumUnauthorized() };
  if (!session.alumni.communityOptedInAt) return { error: forumNotOptedIn() };
  const membership = await findMembership(groupId, session.alumni.id);
  if (!membership) {
    return {
      error: NextResponse.json(
        { error: "กรุณาเข้าร่วมกลุ่มนี้ก่อนใช้งาน", code: "NOT_A_MEMBER" },
        { status: 403 },
      ),
    };
  }
  return { alumni: session.alumni };
}

export { alumniLogCtx };

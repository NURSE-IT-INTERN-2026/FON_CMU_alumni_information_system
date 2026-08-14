import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { clampPaging } from "@/lib/pagination";
import { PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@/app/generated/prisma/client";
import { logActivity } from "@/lib/activity-log";
import { resolveGroupReader, alumniLogCtx } from "@/lib/group-guard";
import { resolveEventCreator, adminLogCtx } from "@/lib/event-guard";
import { communityRateLimit, COMMUNITY_POST_LIMIT } from "@/lib/community-rate-limit";
import { handleZodError, groupCreateSchema } from "@/lib/validations";

/**
 * Community V2 groups. GET = list (staff OR opted-in alum via the forum gate);
 * each row carries `isMember`/`myRole` via ONE batched membership query.
 * POST = create an INTEREST group (staff via checkWritePermission, or an
 * opted-in alum — creator becomes MODERATOR + first member).
 */

/** ASCII-safe slug from a Thai title: keep typeable ASCII, hash the rest. */
function slugifyGroupTitle(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  // Non-ASCII titles produce "" — fall back to a short deterministic hash of
  // the title so the slug is unique + stable without transliterating Thai.
  if (!ascii) {
    let h = 0;
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
    return `g-${h.toString(36)}`;
  }
  return ascii;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 0; ; i++) {
    const clash = await prisma.communityGroup.findUnique({ where: { slug } });
    if (!clash) return slug;
    slug = `${base}-${i + 2}`;
  }
}

export async function GET(request: NextRequest) {
  try {
    const reader = await resolveGroupReader();
    if ("error" in reader) return reader.error;

    const { searchParams } = request.nextUrl;
    const { page, pageSize } = clampPaging(
      parseInt(searchParams.get("page") || "1", 10),
      parseInt(searchParams.get("pageSize") || String(PAGE_SIZE), 10),
    );
    const search = (searchParams.get("search") || "").trim();
    const kind = searchParams.get("kind") === "INTEREST" ? "INTEREST" : searchParams.get("kind") === "COHORT" ? "COHORT" : undefined;
    // `mine=true` filters to the requesting alum's memberships (staff see all).
    const mine = searchParams.get("mine") === "true" && reader.alumni != null;

    const where: Prisma.CommunityGroupWhereInput = { deletedAt: null };
    if (kind) where.kind = kind;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (mine && reader.alumni) where.memberships = { some: { alumniId: reader.alumni.id } };

    const [groups, total] = await Promise.all([
      prisma.communityGroup.findMany({
        where,
        orderBy: [{ memberCount: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.communityGroup.count({ where }),
    ]);

    // isMember + myRole via one batched query (not per-row).
    const ids = groups.map((g) => g.id);
    const myMemberships = reader.alumni && ids.length
      ? await prisma.groupMembership.findMany({
          where: { alumniId: reader.alumni.id, groupId: { in: ids } },
          select: { groupId: true, role: true },
        })
      : [];
    const roleByGroup = new Map(myMemberships.map((m) => [m.groupId, m.role]));

    const data = groups.map((g) => ({
      ...g,
      isMember: roleByGroup.has(g.id),
      myRole: roleByGroup.get(g.id) ?? null,
    }));

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error("GET /api/groups error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่ม" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Same creator rule as events: staff (exec blocked) OR opted-in alum.
    const creator = await resolveEventCreator();
    if ("error" in creator) return creator.error;

    const rl = communityRateLimit(request, "post", COMMUNITY_POST_LIMIT);
    if (rl) return rl;

    const v = groupCreateSchema.parse(await request.json());
    const slug = await uniqueSlug(slugifyGroupTitle(v.title));

    const group = await prisma.communityGroup.create({
      data: {
        slug,
        kind: "INTEREST",
        title: v.title,
        description: v.description ?? "",
        memberCount: 1,
        memberships: "alumni" in creator
          ? { create: { alumniId: creator.alumni.id, role: "MODERATOR" } }
          : undefined,
      },
    });

    const actor = "staff" in creator ? adminLogCtx(creator.staff) : alumniLogCtx(creator.alumni);
    await logActivity(actor, "CREATE", "community_group", group.id, { title: group.title, slug: group.slug });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("POST /api/groups error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างกลุ่ม" }, { status: 500 });
  }
}

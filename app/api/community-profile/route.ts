import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { requireForumAlumni, alumniLogCtx } from "@/lib/forum-guard";
import { communityProfileSchema, handleZodError } from "@/lib/validations";

/**
 * The logged-in opted-in alumni's OWN community profile (V2). No `/[id]` —
 * operates on the session identity only (mirrors /api/alumni-profile).
 *
 * GET  → the row or null (nothing filled in yet).
 * PUT  → upsert (creates the row on first save). Empty strings normalize to
 *        null so the form can clear fields.
 */

/** zod-validated keys we persist — never trust extra body keys. */
const PROFILE_FIELDS = [
  "photoUrl",
  "currentWorkplace",
  "currentPosition",
  "province",
  "country",
  "bio",
  "contactEmail",
  "facebookUrl",
  "lineId",
  "linkedinUrl",
  "otherLink",
] as const;

function profileData(input: z.infer<typeof communityProfileSchema>) {
  const data: Record<string, string | null> = {};
  for (const field of PROFILE_FIELDS) {
    const value = input[field];
    data[field] = value ? value.trim() || null : null;
  }
  return data;
}

export async function GET() {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;

    const profile = await prisma.communityProfile.findUnique({
      where: { alumniId: a.alumni.id },
    });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("GET /api/community-profile error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์ชุมชน" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;

    const validated = communityProfileSchema.parse(await request.json());
    const data = profileData(validated);

    const profile = await prisma.communityProfile.upsert({
      where: { alumniId: alumni.id },
      create: { alumniId: alumni.id, ...data },
      update: data,
    });

    await logActivity(
      alumniLogCtx(alumni),
      "UPDATE",
      "community_profile",
      profile.id,
      { updatedFields: PROFILE_FIELDS.filter((f) => data[f] !== null) },
    );

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/community-profile error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึกโปรไฟล์ชุมชน" },
      { status: 500 },
    );
  }
}

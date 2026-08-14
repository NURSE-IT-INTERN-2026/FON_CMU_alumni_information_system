import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { resolveForumReader } from "@/lib/forum-guard";
import { SELECT_ALUMNI_DIRECTORY_IDENTITY } from "@/lib/forum-identity";

/**
 * One directory entry (community V2): an opted-in alum's public community
 * profile. 404 when the id is unknown OR the alum is not opted in (opt-out
 * hides the profile) OR soft-deleted. Gate: staff OR opted-in alumni.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveForumReader();
    if ("error" in reader) return reader.error;

    const { id } = await params;

    const alumni = await prisma.alumni.findFirst({
      where: {
        id,
        deletedAt: null,
        communityOptedInAt: { not: null },
      },
      select: SELECT_ALUMNI_DIRECTORY_IDENTITY,
    });
    if (!alumni) {
      return NextResponse.json(
        { error: "ไม่พบสมาชิกในไดเรกทอรีศิษย์เก่า" },
        { status: 404 },
      );
    }

    return NextResponse.json({ alumni });
  } catch (error) {
    console.error("GET /api/directory/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์ศิษย์เก่า" },
      { status: 500 },
    );
  }
}

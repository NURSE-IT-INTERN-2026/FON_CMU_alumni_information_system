import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireForumAlumni } from "@/lib/forum-guard";

// Toggle the requesting alum's like on a post. Idempotent: returns the new
// state. The denormalized FeedPost.likeCount is maintained in the same
// $transaction so it never drifts.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await requireForumAlumni();
    if ("error" in a) return a.error;
    const alumni = a.alumni;
    const { id: postId } = await params;

    const existing = await prisma.feedLike.findUnique({
      where: { postId_alumniId: { postId, alumniId: alumni.id } },
    });

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.feedLike.delete({ where: { id: existing.id } });
        await tx.feedPost.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } });
      } else {
        await tx.feedLike.create({ data: { postId, alumniId: alumni.id } });
        await tx.feedPost.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
      }
    });

    const post = await prisma.feedPost.findUnique({ where: { id: postId }, select: { likeCount: true } });
    return NextResponse.json({ liked: !existing, likeCount: post?.likeCount ?? 0 });
  } catch (error) {
    console.error("POST /api/feed/[id]/like error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

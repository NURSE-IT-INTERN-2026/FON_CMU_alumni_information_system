import { NextRequest, NextResponse } from "next/server";
import { MAX_FILE_SIZE, saveImageUpload } from "@/lib/upload";
import { requireForumAlumni } from "@/lib/forum-guard";

// Alumni image upload for community content (the activity feed). Gated on an
// OPTED-IN alumni (same gate as posting) — `POST /api/upload` is admin-only, so
// alumni reach the shared saveImageUpload helper through this route instead.
// Same 5 MB / PNG+JPG / magic-byte rules; writes to the same `public/uploads`.
export async function POST(request: NextRequest) {
  const a = await requireForumAlumni();
  if ("error" in a) return a.error;
  try {
    const contentLength = parseInt(request.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE * 2) {
      return NextResponse.json({ error: "ขนาดไฟล์ต้องไม่เกิน 5MB" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "กรุณาเลือกไฟล์" }, { status: 400 });
    }

    const result = await saveImageUpload(file);
    if ("error" in result) return result.error;
    return NextResponse.json({ url: result.url }, { status: 201 });
  } catch (error) {
    console.error("POST /api/alumni-upload error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์" }, { status: 500 });
  }
}

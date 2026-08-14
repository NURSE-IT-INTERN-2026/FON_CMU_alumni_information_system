import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import { MAX_FILE_SIZE, saveImageUpload } from "@/lib/upload";

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    // Defense-in-depth: reject an oversized upload from its Content-Length
    // BEFORE buffering the body. A client can omit/under-report it (or use
    // chunked encoding), so the authoritative cap is the reverse proxy
    // (nginx `client_max_body_size`) + saveImageUpload's post-read size check.
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
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์" }, { status: 500 });
  }
}

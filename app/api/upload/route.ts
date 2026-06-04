import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { checkWritePermission } from "@/lib/permissions";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Magic byte signatures for allowed image types
const MAGIC_BYTES: {
  signature: number[];
  mimeType: string;
  ext: string;
}[] = [
  { signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mimeType: "image/png", ext: "png" },
  { signature: [0xff, 0xd8, 0xff], mimeType: "image/jpeg", ext: "jpg" },
];

function detectImageType(buffer: Buffer): { mimeType: string; ext: string } | null {
  for (const { signature, mimeType, ext } of MAGIC_BYTES) {
    let match = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        match = false;
        break;
      }
    }
    if (match) return { mimeType, ext };
  }
  return null;
}

export async function POST(request: NextRequest) {
  const permErr = await checkWritePermission();
  if (permErr) return permErr;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "กรุณาเลือกไฟล์" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ขนาดไฟล์ต้องไม่เกิน 5MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate actual file content via magic bytes, not the client-reported Content-Type
    const detected = detectImageType(buffer);
    if (!detected) {
      return NextResponse.json(
        { error: "อนุญาตเฉพาะไฟล์ PNG และ JPG เท่านั้น" },
        { status: 400 }
      );
    }

    // Use extension derived from validated type, not the user-provided filename
    const filename = `${randomUUID()}.${detected.ext}`;
    const filepath = join(process.cwd(), "public", "uploads", filename);

    await writeFile(filepath, buffer);

    return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์" },
      { status: 500 }
    );
  }
}

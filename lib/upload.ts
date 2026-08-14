import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Magic-byte signatures for allowed image types (validate real content, not the
// client-reported Content-Type). Only the extension is needed downstream.
const MAGIC_BYTES: { signature: number[]; ext: string }[] = [
  { signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ext: "png" },
  { signature: [0xff, 0xd8, 0xff], ext: "jpg" },
];

function detectImageExt(buffer: Buffer): string | null {
  for (const { signature, ext } of MAGIC_BYTES) {
    if (signature.every((b, i) => buffer[i] === b)) return ext;
  }
  return null;
}

/**
 * Validate (size + magic bytes) and save an uploaded image to `public/uploads`.
 * Shared by the admin `/api/upload` and the opt-in-alumni `/api/alumni-upload`
 * so both enforce identical rules. Returns `{ url }` (basePath-relative, like
 * news covers — render via `assetUrl`) or `{ error }`.
 */
export async function saveImageUpload(
  file: File,
): Promise<{ url: string } | { error: NextResponse }> {
  if (file.size > MAX_FILE_SIZE) {
    return { error: NextResponse.json({ error: "ขนาดไฟล์ต้องไม่เกิน 5MB" }, { status: 400 }) };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = detectImageExt(buffer);
  if (!ext) {
    return { error: NextResponse.json({ error: "อนุญาตเฉพาะไฟล์ PNG และ JPG เท่านั้น" }, { status: 400 }) };
  }
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(join(process.cwd(), "public", "uploads", filename), buffer);
  return { url: `/uploads/${filename}` };
}

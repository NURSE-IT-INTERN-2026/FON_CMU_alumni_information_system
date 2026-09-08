/**
 * Client-safe upload limits (no fs/Prisma imports — safe to import from
 * client components). `MAX_FILE_SIZE` is the single source of truth;
 * `lib/upload.ts` (server) re-exports it so both routes share one constant.
 */

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const IMAGE_MIME_RE = /^image\/(jpeg|png)$/; // jpg + jpeg are both image/jpeg

/**
 * Pre-check an image picked in the browser: 5 MB max, JPG/JPEG/PNG only.
 * Returns a Thai error message, or null when the file passes.
 *
 * This is a UX pre-filter only (the reported MIME type is spoofable) — the
 * authoritative gate is `saveImageUpload`'s size + magic-byte check on the
 * server, which every upload route funnels through.
 */
export function validateImageFile(file: File): string | null {
  if (!IMAGE_MIME_RE.test(file.type)) {
    return "อนุญาตเฉพาะไฟล์ JPG และ PNG เท่านั้น";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "ขนาดไฟล์ต้องไม่เกิน 5MB";
  }
  return null;
}

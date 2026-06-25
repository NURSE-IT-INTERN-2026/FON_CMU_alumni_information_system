/**
 * Client-side image crop + resize helpers (DOM Canvas API only — no Prisma, safe to import
 * from client components). Used by the news image editor dialog to re-encode an uploaded
 * image to a cropped and/or resized PNG/JPEG Blob before re-uploading.
 *
 * Uploads are same-origin (`/alumni/uploads/...` via `assetUrl`), so the canvas is never
 * tainted and `toBlob` works.
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ImageMime = "image/png" | "image/jpeg";

/** Load an <img> from a URL and wait for it to decode. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("โหลดรูปภาพไม่สำเร็จ"));
    img.src = src;
  });
}

/**
 * Draw a (possibly cropped) region of `img`, scaled to `targetWidth` (aspect-locked), and
 * return the re-encoded Blob.
 *
 * - `area` null  → use the whole image.
 * - `targetWidth` null/<=0 → keep the source region's pixel width (crop-only).
 * - Output height is always derived from the aspect ratio (never skewed).
 */
export function cropAndResize(
  img: HTMLImageElement,
  area: CropArea | null,
  targetWidth: number | null,
  mime: ImageMime,
  quality = 0.92,
): Promise<Blob> {
  const sx = area ? Math.round(area.x) : 0;
  const sy = area ? Math.round(area.y) : 0;
  const sw = area ? Math.round(area.width) : img.naturalWidth;
  const sh = area ? Math.round(area.height) : img.naturalHeight;
  if (sw <= 0 || sh <= 0) throw new Error("ขนาดรูปภาพไม่ถูกต้อง");

  const outW = targetWidth && targetWidth > 0 ? Math.round(targetWidth) : sw;
  const scale = outW / sw;
  const outH = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่รองรับ Canvas");
  // JPEG has no alpha channel — paint a white backdrop so transparent PNG areas don't turn black.
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("เข้ารหัสรูปภาพไม่สำเร็จ"))),
      mime,
      quality,
    );
  });
}

/** Derive the output mime from a URL/filename (PNG keeps transparency; else JPEG for size). */
export function mimeFromSrc(src: string): ImageMime {
  return /\.png(\?|$)/i.test(src) ? "image/png" : "image/jpeg";
}

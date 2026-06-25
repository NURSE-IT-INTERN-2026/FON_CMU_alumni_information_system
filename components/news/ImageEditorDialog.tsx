"use client";

import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  cropAndResize,
  loadImage,
  mimeFromSrc,
  type CropArea,
} from "@/lib/image-edit";

interface ImageEditorDialogProps {
  /** Full browser URL of the source image (already basePath-resolved via `assetUrl`).
   *  The parent should mount this component only while editing (keyed by src) so it
   *  starts from a clean state each time. */
  src: string;
  /** Crop aspect ratio. 16/9 for the cover; undefined = freeform (body images). */
  aspect?: number;
  title?: string;
  onClose: () => void;
  /** Receives the re-encoded (cropped + resized) image as a File. */
  onConfirm: (file: File) => void | Promise<void>;
}

export function ImageEditorDialog({
  src,
  aspect,
  title = "แก้ไขรูปภาพ",
  onClose,
  onConfirm,
}: ImageEditorDialogProps) {
  // Fresh-open defaults; the parent remounts (key=src) on each open.
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [width, setWidth] = useState<number | "">("");

  // Load the source image on mount; setState only in async callbacks (never synchronously
  // in the effect body) to avoid cascading renders.
  useEffect(() => {
    let cancelled = false;
    loadImage(src)
      .then((im) => {
        if (cancelled) return;
        setImg(im);
        setWidth(Math.min(im.naturalWidth, 2000));
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [src]);

  const regionW = area?.width ?? img?.naturalWidth ?? 1;
  const regionH = area?.height ?? img?.naturalHeight ?? 1;
  const outW = typeof width === "number" && width > 0 ? width : regionW;
  const previewH = Math.round((outW * regionH) / regionW);

  const clampWidth = (v: string) => {
    if (v === "") return "";
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return "";
    return Math.max(50, Math.min(2000, n));
  };

  const handleConfirm = async () => {
    if (!img) return;
    const mime = mimeFromSrc(src);
    const targetW = typeof width === "number" && width > 0 ? width : null;
    setBusy(true);
    try {
      const blob = await cropAndResize(img, area, targetW, mime);
      const ext = mime === "image/png" ? "png" : "jpg";
      const file = new File([blob], `edit.${ext}`, { type: mime });
      await onConfirm(file);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-gray-100">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              กำลังโหลด…
            </div>
          ) : failed ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-red-500">
              โหลดรูปภาพไม่สำเร็จ
            </div>
          ) : (
            img && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_a, pixels) => setArea(pixels as CropArea)}
              />
            )
          )}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="w-16 shrink-0">ซูม</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
            aria-label="ซูม"
          />
        </div>

        {/* Resize (re-encode to chosen width, aspect-locked) */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span className="w-16 shrink-0">ความกว้าง</span>
          <input
            type="number"
            min={50}
            max={2000}
            step={1}
            value={width}
            onChange={(e) => setWidth(clampWidth(e.target.value))}
            onBlur={(e) => setWidth(clampWidth(e.target.value))}
            className="w-24 rounded border border-gray-300 px-2 py-1 outline-none focus:border-[var(--primary)]"
            aria-label="ความกว้าง (px)"
          />
          <span>px</span>
          {img && (
            <span className="text-xs text-gray-400">
              → สูง {previewH}px (ตามสัดส่วน)
            </span>
          )}
          {img && (
            <button
              type="button"
              onClick={() => setWidth(Math.min(img.naturalWidth, 2000))}
              className="ml-auto text-xs text-[var(--primary)] hover:underline"
            >
              ใช้ขนาดเดิม
            </button>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!img || loading || busy || failed}
          >
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

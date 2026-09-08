"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Modal } from "@/components/ui/modal";
import { BASE_PATH } from "@/lib/constants";
import { validateImageFile } from "@/lib/upload-limits";
import { assetUrl } from "@/lib/asset-url";
import { MAX_EVENT_PHOTOS } from "@/lib/event-photo-gate";

/**
 * "อัลบั้มภาพกิจกรรม" — per-event photo grid (community V2). Self-contained:
 * lists photos, uploads (via /api/alumni-upload then POST register), deletes
 * own photos. The API gates uploads to ATTENDING/organizer/staff — a viewer
 * who can't upload sees the grid only.
 */

interface EventPhotoItem {
  id: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
  uploaderAlumniId: string | null;
  canDelete: boolean;
}

export default function EventPhotoAlbum({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canUpload, setCanUpload] = useState(false);
  const [viewing, setViewing] = useState<EventPhotoItem | null>(null);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.eventPhotos.list(eventId),
    queryFn: () => apiFetch<{ data: EventPhotoItem[]; total: number }>(`/api/events/${eventId}/photos?pageSize=60`),
  });

  const upload = useMutation({
    mutationFn: (input: { imageUrl: string; caption?: string }) =>
      apiFetch(`/api/events/${eventId}/photos`, { method: "POST", json: input }),
    onSuccess: () => {
      setCaption("");
      setError(null);
      setCanUpload(true);
      qc.invalidateQueries({ queryKey: queryKeys.eventPhotos.list(eventId) });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาดในการอัปโหลดรูป"),
  });

  const remove = useMutation({
    mutationFn: (photoId: string) =>
      apiFetch(`/api/events/${eventId}/photos/${photoId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.eventPhotos.list(eventId) }),
    onError: (e) => setError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาดในการลบรูป"),
  });

  async function handleFile(file: File) {
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (photos.length >= MAX_EVENT_PHOTOS) {
      setError(`อัปโหลดรูปได้สูงสุด ${MAX_EVENT_PHOTOS} รูปต่อกิจกรรม`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE_PATH}/api/alumni-upload`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "อัปโหลดไม่สำเร็จ");
      }
      const { url } = await res.json();
      upload.mutate({ imageUrl: url, caption: caption.trim() || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  const photos = data?.data ?? [];
  const total = data?.total ?? 0;
  const atCap = total >= MAX_EVENT_PHOTOS;

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-[var(--primary)]">อัลบั้มภาพกิจกรรม</h2>
      <p className="mb-4 text-sm text-[var(--muted)]">
        รูปภาพจากผู้เข้าร่วมกิจกรรม ({total}/{MAX_EVENT_PHOTOS} รูป) — ผู้ที่ลงทะเบียนเข้าร่วมสามารถอัปโหลดรูปได้
      </p>

      {atCap ? (
        <p className="mb-4 rounded-md bg-[var(--primary)]/5 px-3 py-2 text-sm text-[var(--muted)]">
          อัปโหลดรูปครบตามจำกัดแล้ว ({MAX_EVENT_PHOTOS} รูป) — ลบรูปเดิมเพื่ออัปโหลดเพิ่ม
        </p>
      ) : (
        /* Upload row (non-attendees get 403 from the API; the error shows inline) */
        <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            placeholder="คำบรรยายรูป (ไม่บังคับ)"
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm sm:w-64"
          />
          <label className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-purple-50">
            {uploading ? "กำลังอัปโหลด..." : "📷 อัปโหลดรูปภาพ"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              disabled={uploading || upload.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {canUpload && <span className="text-xs text-green-600">อัปโหลดสำเร็จ</span>}
        </div>
      )}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {isPending ? (
        <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div>
      ) : photos.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">ยังไม่มีรูปภาพในอัลบั้มนี้</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.id} className="group relative overflow-hidden rounded-lg border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setViewing(p)}
                title="ดูรูปภาพเต็มขนาด"
                aria-label={p.caption ? `ดูรูปภาพ: ${p.caption}` : "ดูรูปภาพเต็มขนาด"}
                className="block w-full cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(p.imageUrl)} alt={p.caption ?? "รูปกิจกรรม"} className="h-40 w-full object-cover" />
              </button>
              {p.caption && (
                <figcaption className="bg-white px-2 py-1 text-xs text-[var(--muted)]">{p.caption}</figcaption>
              )}
              {p.canDelete && (
                <button
                  onClick={() => remove.mutate(p.id)}
                  disabled={remove.isPending}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  ลบ
                </button>
              )}
            </figure>
          ))}
        </div>
      )}

      {/* Full-size viewer (broadcast-read: anyone who can see the grid) */}
      {viewing && (
        <Modal
          open
          onOpenChange={(o) => { if (!o) setViewing(null); }}
          title="รูปภาพกิจกรรม"
          size="lg"
          scrollBody
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetUrl(viewing.imageUrl)}
            alt={viewing.caption ?? "รูปกิจกรรม"}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
          {viewing.caption && (
            <p className="mt-2 text-center text-sm text-[var(--muted)]">{viewing.caption}</p>
          )}
        </Modal>
      )}
    </section>
  );
}

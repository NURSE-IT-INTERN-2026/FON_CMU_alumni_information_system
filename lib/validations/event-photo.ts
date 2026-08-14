import { z } from "zod";

/**
 * Community V2 event photo albums. The upload itself goes through
 * /api/alumni-upload (5MB/PNG+JPG/magic bytes); this schema covers the
 * follow-up POST that registers the uploaded URL on the event.
 */
export const eventPhotoCreateSchema = z.object({
  imageUrl: z.string().trim().min(1, "กรุณาอัปโหลดรูปภาพก่อน").max(500),
  caption: z.string().trim().max(200, "คำบรรยายต้องไม่เกิน 200 ตัวอักษร").optional(),
});

export type EventPhotoCreateInput = z.infer<typeof eventPhotoCreateSchema>;

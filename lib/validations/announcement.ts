import { z } from "zod";

/**
 * Community V2 staff announcements — short plain-text notices (no Tiptap).
 */
export const announcementCreateSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อประกาศ").max(200, "หัวข้อยาวเกินไป"),
  body: z.string().trim().min(1, "กรุณากรอกเนื้อหาประกาศ").max(5000, "เนื้อหายาวเกินไป"),
  pinned: z.boolean().optional().default(false),
  // Optional datetime-local expiry; the route converts Bangkok → UTC.
  expiresAt: z.string().optional(),
});

export const announcementUpdateSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อประกาศ").max(200, "หัวข้อยาวเกินไป").optional(),
  body: z.string().trim().min(1, "กรุณากรอกเนื้อหาประกาศ").max(5000, "เนื้อหายาวเกินไป").optional(),
  pinned: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
});

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
export type AnnouncementUpdateInput = z.infer<typeof announcementUpdateSchema>;

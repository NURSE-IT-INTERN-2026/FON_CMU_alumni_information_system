import { z } from "zod";

/**
 * Community profile (V2) — the opted-in alumni's self-published profile.
 * Everything is optional except a length cap on `bio`; an empty PUT just
 * clears fields. URLs are validated when non-empty; `lineId` is a LINE ID
 * (text), not a URL.
 */
export const communityProfileSchema = z.object({
  photoUrl: z
    .string()
    .max(500, "ที่อยู่รูปภาพยาวเกินไป")
    .nullable()
    .optional(),
  currentWorkplace: z.string().max(200, "สถานที่ทำงานยาวเกินไป").nullable().optional(),
  currentPosition: z.string().max(200, "ตำแหน่งยาวเกินไป").nullable().optional(),
  province: z.string().max(100, "จังหวัดยาวเกินไป").nullable().optional(),
  country: z.string().max(100, "ประเทศยาวเกินไป").nullable().optional(),
  bio: z.string().max(2000, "แนะนำตัวต้องไม่เกิน 2,000 ตัวอักษร").nullable().optional(),
  contactEmail: z
    .string()
    .max(200, "อีเมลยาวเกินไป")
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .nullable()
    .optional()
    .or(z.literal("")),
  facebookUrl: z
    .string()
    .max(500, "ลิงก์ยาวเกินไป")
    .url("รูปแบบลิงก์ไม่ถูกต้อง")
    .nullable()
    .optional()
    .or(z.literal("")),
  lineId: z.string().max(100, "LINE ID ยาวเกินไป").nullable().optional(),
  linkedinUrl: z
    .string()
    .max(500, "ลิงก์ยาวเกินไป")
    .url("รูปแบบลิงก์ไม่ถูกต้อง")
    .nullable()
    .optional()
    .or(z.literal("")),
  otherLink: z
    .string()
    .max(500, "ลิงก์ยาวเกินไป")
    .url("รูปแบบลิงก์ไม่ถูกต้อง")
    .nullable()
    .optional()
    .or(z.literal("")),
});

export type CommunityProfileInput = z.infer<typeof communityProfileSchema>;

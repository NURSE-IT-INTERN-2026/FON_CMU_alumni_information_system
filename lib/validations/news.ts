import { z } from "zod";

const MSG = {
  titleRequired: "กรุณากรอกชื่อเรื่อง",
  bodyRequired: "กรุณากรอกเนื้อหา",
  statusInvalid: "สถานะไม่ถูกต้อง",
};

export const NEWS_STATUS_VALUES = ["DRAFT", "PUBLISHED", "DISCONTINUED"] as const;

// --- Form schema ---

export const newsFormSchema = z.object({
  title: z.string().min(1, MSG.titleRequired),
  body: z.string().min(1, MSG.bodyRequired),
  coverImageUrl: z.string().optional().nullable(),
  status: z.enum(NEWS_STATUS_VALUES, {
    message: MSG.statusInvalid,
  }).optional().default("DRAFT"),
});

// --- API schemas ---

export const newsCreateSchema = z.object({
  title: z.string().min(1, MSG.titleRequired),
  body: z.string().min(1, MSG.bodyRequired),
  coverImageUrl: z.string().optional().nullable(),
  status: z.enum(NEWS_STATUS_VALUES).optional().default("DRAFT"),
});

export const newsUpdateSchema = z.object({
  title: z.string().min(1, MSG.titleRequired).optional(),
  body: z.string().min(1, MSG.bodyRequired).optional(),
  coverImageUrl: z.string().optional().nullable(),
  status: z.enum(NEWS_STATUS_VALUES).optional(),
});

export type NewsFormData = z.infer<typeof newsFormSchema>;
export type NewsCreateInput = z.infer<typeof newsCreateSchema>;
export type NewsUpdateInput = z.infer<typeof newsUpdateSchema>;

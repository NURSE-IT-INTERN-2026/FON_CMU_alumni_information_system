import { z } from "zod";
import { buddhistYearField, editReasonField } from "./helpers";

const MSG = {
  awardNameRequired: "กรุณากรอกชื่อรางวัล",
  awardTypeRequired: "กรุณาเลือกประเภทรางวัล",
  awardTypeInvalid: "ประเภทรางวัลไม่ถูกต้อง",
  descriptionRequired: "กรุณากรอกรายละเอียด",
};

export const AWARD_TYPE_VALUES = ["INTERNATIONAL", "NATIONAL", "LOCAL"] as const;

// --- Form schema (all strings) ---

export const awardFormSchema = z.object({
  awardName: z.string().min(1, MSG.awardNameRequired),
  awardType: z.enum(AWARD_TYPE_VALUES, {
    message: MSG.awardTypeRequired,
  }),
  year: buddhistYearField("กรุณากรอกปี", "ปีต้องเป็นตัวเลข 4 หลัก"),
  description: z.string().min(1, MSG.descriptionRequired),
});

// --- API schemas ---

export const awardCreateSchema = z.object({
  studentId: z.string().optional().nullable(),
  recipientName: z.string().optional().nullable(),
  awardName: z.string().min(1, MSG.awardNameRequired).trim(),
  awardType: z.enum(AWARD_TYPE_VALUES, {
    message: MSG.awardTypeRequired,
  }),
  year: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
  description: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
});

export const awardUpdateSchema = z.object({
  studentId: z.string().optional().nullable(),
  recipientName: z.string().optional().nullable(),
  awardName: z.string().min(1, MSG.awardNameRequired).trim().optional(),
  awardType: z.enum(AWARD_TYPE_VALUES).optional(),
  year: z.coerce.number().int("ปีต้องเป็นตัวเลข").optional(),
  description: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
  reason: editReasonField(),
});

export type AwardFormData = z.infer<typeof awardFormSchema>;
export type AwardCreateInput = z.infer<typeof awardCreateSchema>;
export type AwardUpdateInput = z.infer<typeof awardUpdateSchema>;

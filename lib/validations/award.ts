import { z } from "zod";
import { buddhistYearField, editReasonField } from "./helpers";

const MSG = {
  awardNameRequired: "กรุณากรอกชื่อรางวัล",
  awardTypeRequired: "กรุณาเลือกประเภทรางวัล",
  firstNameRequired: "กรุณากรอกชื่อ",
  lastNameRequired: "กรุณากรอกนามสกุล",
};

export const AWARD_TYPE_VALUES = ["INTERNATIONAL", "NATIONAL", "LOCAL"] as const;

// --- Form schema (shared with the alumni full-form via alumni-with-related) ---
// Name fields are OPTIONAL here so the full-form (which derives the recipient
// name from the parent alumni) can omit them; the route auto-fills them.
// description is nullable per PRD, so it's optional (imported rows have none).
export const awardFormSchema = z.object({
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().optional().nullable(),
  lastName: z.string().trim().optional().nullable(),
  awardName: z.string().min(1, MSG.awardNameRequired),
  awardType: z.enum(AWARD_TYPE_VALUES, { message: MSG.awardTypeRequired }),
  year: buddhistYearField("กรุณากรอกปี", "ปีต้องเป็นตัวเลข 4 หลัก"),
  link: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

// Standalone awards-page form — recipient name is required on this form.
export const awardPageFormSchema = awardFormSchema.extend({
  firstName: z.string().trim().min(1, MSG.firstNameRequired),
  lastName: z.string().trim().min(1, MSG.lastNameRequired),
});

// --- API schemas ---

export const awardCreateSchema = z.object({
  studentId: z.string().optional().nullable(),
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1, MSG.firstNameRequired),
  lastName: z.string().trim().min(1, MSG.lastNameRequired),
  awardName: z.string().min(1, MSG.awardNameRequired).trim(),
  awardType: z.enum(AWARD_TYPE_VALUES, {
    message: MSG.awardTypeRequired,
  }),
  year: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
  link: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  description: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
});

export const awardUpdateSchema = z.object({
  studentId: z.string().optional().nullable(),
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1, MSG.firstNameRequired).optional(),
  lastName: z.string().trim().min(1, MSG.lastNameRequired).optional(),
  awardName: z.string().min(1, MSG.awardNameRequired).trim().optional(),
  awardType: z.enum(AWARD_TYPE_VALUES).optional(),
  year: z.coerce.number().int("ปีต้องเป็นตัวเลข").optional(),
  link: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  description: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
  reason: editReasonField(),
});

export type AwardFormData = z.infer<typeof awardFormSchema>;
export type AwardPageFormData = z.infer<typeof awardPageFormSchema>;
export type AwardCreateInput = z.infer<typeof awardCreateSchema>;
export type AwardUpdateInput = z.infer<typeof awardUpdateSchema>;

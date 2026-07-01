import { z } from "zod";
import { buddhistYearField, editReasonField } from "./helpers";

const MSG = {
  studentIdRequired: "กรุณาระบุรหัสนักศึกษา",
  careerRequired: "กรุณากรอกอาชีพ",
  positionRequired: "กรุณากรอกตำแหน่ง",
  firstNameRequired: "กรุณากรอกชื่อ",
  lastNameRequired: "กรุณากรอกนามสกุล",
};

// --- Form schema (shared with the alumni full-form via alumni-with-related) ---
// Name fields are OPTIONAL here so the full-form (which derives the name from
// the parent alumni) can omit them; the route auto-fills them.
export const potentialFormSchema = z.object({
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().optional().nullable(),
  lastName: z.string().trim().optional().nullable(),
  career: z.string().min(1, MSG.careerRequired),
  position: z.string().min(1, MSG.positionRequired),
  recordedYear: buddhistYearField("กรุณากรอกปีที่บันทึก", "ปีต้องเป็นตัวเลข 4 หลัก"),
});

// Standalone management-page form — name is required on this form.
export const potentialPageFormSchema = potentialFormSchema.extend({
  firstName: z.string().trim().min(1, MSG.firstNameRequired),
  lastName: z.string().trim().min(1, MSG.lastNameRequired),
});

// --- API schemas ---

export const potentialCreateSchema = z.object({
  studentId: z.string().trim().optional().nullable(),
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1, MSG.firstNameRequired),
  lastName: z.string().trim().min(1, MSG.lastNameRequired),
  career: z.string().min(1, MSG.careerRequired).trim(),
  position: z.string().min(1, MSG.positionRequired).trim(),
  recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
  major: z.string().optional().nullable(),
});

export const potentialUpdateSchema = z.object({
  studentId: z.string().trim().optional().nullable(),
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1, MSG.firstNameRequired).optional(),
  lastName: z.string().trim().min(1, MSG.lastNameRequired).optional(),
  career: z.string().min(1, MSG.careerRequired).trim().optional(),
  position: z.string().min(1, MSG.positionRequired).trim().optional(),
  recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข").optional(),
  major: z.string().optional().nullable(),
  reason: editReasonField(),
});

export type PotentialFormData = z.infer<typeof potentialFormSchema>;
export type PotentialPageFormData = z.infer<typeof potentialPageFormSchema>;
export type PotentialCreateInput = z.infer<typeof potentialCreateSchema>;
export type PotentialUpdateInput = z.infer<typeof potentialUpdateSchema>;

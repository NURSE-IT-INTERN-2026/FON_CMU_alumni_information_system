import { z } from "zod";
import { editReasonField } from "./helpers";

const MSG = {
  studentIdRequired: "กรุณาระบุรหัสนักศึกษา",
  cohortRequired: "กรุณาเลือกเครือข่าย",
  generationRequired: "กรุณากรอกรุ่นที่",
  generationInvalid: "รุ่นที่ต้องเป็นตัวเลข",
  firstNameRequired: "กรุณากรอกชื่อ",
  lastNameRequired: "กรุณากรอกนามสกุล",
};

// --- Form schema (shared with the alumni full-form via alumni-with-related) ---
// Name fields are OPTIONAL here so the full-form (which derives the name from
// the parent alumni) can omit them; the route auto-fills them.
export const modelRepFormSchema = z.object({
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().optional().nullable(),
  lastName: z.string().trim().optional().nullable(),
  cohort: z.string().min(1, MSG.cohortRequired),
  generation: z
    .string()
    .min(1, MSG.generationRequired)
    .refine((v) => /^\d+$/.test(v), MSG.generationInvalid),
});

// Standalone management-page form — name is required on this form.
export const modelRepPageFormSchema = modelRepFormSchema.extend({
  firstName: z.string().trim().min(1, MSG.firstNameRequired),
  lastName: z.string().trim().min(1, MSG.lastNameRequired),
});

// --- API schemas ---

export const modelRepCreateSchema = z.object({
  studentId: z.string().trim().optional().nullable(),
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1, MSG.firstNameRequired),
  lastName: z.string().trim().min(1, MSG.lastNameRequired),
  cohort: z.string().min(1, MSG.cohortRequired).trim(),
  generation: z.coerce.number().int(MSG.generationInvalid),
  major: z.string().optional().nullable(),
});

export const modelRepUpdateSchema = z.object({
  studentId: z.string().trim().optional().nullable(),
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1, MSG.firstNameRequired).optional(),
  lastName: z.string().trim().min(1, MSG.lastNameRequired).optional(),
  cohort: z.string().min(1, MSG.cohortRequired).trim().optional(),
  generation: z.coerce.number().int(MSG.generationInvalid).optional(),
  major: z.string().optional().nullable(),
  reason: editReasonField(),
});

export type ModelRepFormData = z.infer<typeof modelRepFormSchema>;
export type ModelRepPageFormData = z.infer<typeof modelRepPageFormSchema>;
export type ModelRepCreateInput = z.infer<typeof modelRepCreateSchema>;
export type ModelRepUpdateInput = z.infer<typeof modelRepUpdateSchema>;

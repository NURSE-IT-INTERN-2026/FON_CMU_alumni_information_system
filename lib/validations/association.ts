import { z } from "zod";
import { buddhistYearField, editReasonField } from "./helpers";

const MSG = {
  studentIdRequired: "กรุณาระบุรหัสนักศึกษา",
  associationNameRequired: "กรุณากรอกชื่อสมาคม/ชมรม",
  positionRequired: "กรุณากรอกตำแหน่ง",
  firstNameRequired: "กรุณากรอกชื่อ",
  lastNameRequired: "กรุณากรอกนามสกุล",
};

// --- Form schema (shared with the alumni full-form via alumni-with-related) ---
// Name fields are OPTIONAL here so the full-form (which derives the name from
// the parent alumni) can omit them; the route auto-fills them.
export const associationFormSchema = z.object({
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().optional().nullable(),
  lastName: z.string().trim().optional().nullable(),
  associationName: z.string().min(1, MSG.associationNameRequired),
  position: z.string().min(1, MSG.positionRequired),
  recordedYear: buddhistYearField("กรุณากรอกปีที่บันทึก", "ปีต้องเป็นตัวเลข 4 หลัก"),
});

// Standalone management-page form — name is required on this form.
export const associationPageFormSchema = associationFormSchema.extend({
  firstName: z.string().trim().min(1, MSG.firstNameRequired),
  lastName: z.string().trim().min(1, MSG.lastNameRequired),
});

// --- API schemas ---

export const associationCreateSchema = z.object({
  studentId: z.string().trim().optional().nullable(),
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1, MSG.firstNameRequired),
  lastName: z.string().trim().min(1, MSG.lastNameRequired),
  associationName: z.string().min(1, MSG.associationNameRequired).trim(),
  position: z.string().min(1, MSG.positionRequired).trim(),
  recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
  major: z.string().optional().nullable(),
});

export const associationUpdateSchema = z.object({
  studentId: z.string().trim().optional().nullable(),
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1, MSG.firstNameRequired).optional(),
  lastName: z.string().trim().min(1, MSG.lastNameRequired).optional(),
  associationName: z.string().min(1, MSG.associationNameRequired).trim().optional(),
  position: z.string().min(1, MSG.positionRequired).trim().optional(),
  recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข").optional(),
  major: z.string().optional().nullable(),
  reason: editReasonField(),
});

export type AssociationFormData = z.infer<typeof associationFormSchema>;
export type AssociationPageFormData = z.infer<typeof associationPageFormSchema>;
export type AssociationCreateInput = z.infer<typeof associationCreateSchema>;
export type AssociationUpdateInput = z.infer<typeof associationUpdateSchema>;

import { z } from "zod";
import { buddhistYearField, editReasonField } from "./helpers";

const MSG = {
  termYearRequired: "กรุณากรอกปี พ.ศ.",
  studentIdRequired: "กรุณาระบุรหัสนักศึกษา",
  cohortRequired: "กรุณากรอกรุ่นที่",
  positionRequired: "กรุณากรอกตำแหน่ง",
  remarksRequired: "กรุณากรอกหมายเหตุ",
  firstNameRequired: "กรุณากรอกชื่อ",
  lastNameRequired: "กรุณากรอกนามสกุล",
};

// --- Form schema (shared with the alumni full-form via alumni-with-related) ---
// Name fields are OPTIONAL here so the full-form (which derives the name from
// the parent alumni) can omit them; the route auto-fills them.
export const committeeFormSchema = z.object({
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().optional().nullable(),
  lastName: z.string().trim().optional().nullable(),
  termYear: buddhistYearField(MSG.termYearRequired, "ปี พ.ศ. ต้องเป็นตัวเลข 4 หลัก"),
  cohort: z.string().min(1, MSG.cohortRequired),
  position: z.string().min(1, MSG.positionRequired),
  remarks: z.string().min(1, MSG.remarksRequired),
});

// Standalone management-page form — name is required on this form.
export const committeePageFormSchema = committeeFormSchema.extend({
  firstName: z.string().trim().min(1, MSG.firstNameRequired),
  lastName: z.string().trim().min(1, MSG.lastNameRequired),
});

// --- API schemas ---

export const committeeCreateSchema = z.object({
  termYear: z.coerce.number().int("ปี พ.ศ. ต้องเป็นตัวเลข"),
  studentId: z.string().trim().optional().nullable(),
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1, MSG.firstNameRequired),
  lastName: z.string().trim().min(1, MSG.lastNameRequired),
  cohort: z.string().min(1, MSG.cohortRequired).trim(),
  position: z.string().min(1, MSG.positionRequired).trim(),
  remarks: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
});

export const committeeUpdateSchema = z.object({
  termYear: z.coerce.number().int("ปี พ.ศ. ต้องเป็นตัวเลข").optional(),
  studentId: z.string().trim().optional().nullable(),
  prefix: z.string().trim().optional().nullable(),
  firstName: z.string().trim().min(1, MSG.firstNameRequired).optional(),
  lastName: z.string().trim().min(1, MSG.lastNameRequired).optional(),
  cohort: z.string().min(1, MSG.cohortRequired).trim().optional(),
  position: z.string().min(1, MSG.positionRequired).trim().optional(),
  remarks: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
  reason: editReasonField(),
});

export type CommitteeFormData = z.infer<typeof committeeFormSchema>;
export type CommitteePageFormData = z.infer<typeof committeePageFormSchema>;
export type CommitteeCreateInput = z.infer<typeof committeeCreateSchema>;
export type CommitteeUpdateInput = z.infer<typeof committeeUpdateSchema>;

import { z } from "zod";
import { buddhistYearField, editReasonField } from "./helpers";

const MSG = {
  termYearRequired: "กรุณากรอกปี พ.ศ.",
  studentIdRequired: "กรุณาระบุรหัสนักศึกษา",
  fullNameRequired: "กรุณากรอกชื่อ-นามสกุล",
  cohortRequired: "กรุณากรอกรุ่นที่",
  positionRequired: "กรุณากรอกตำแหน่ง",
  remarksRequired: "กรุณากรอกหมายเหตุ",
};

// --- Form schema (all strings) ---

export const committeeFormSchema = z.object({
  termYear: buddhistYearField(MSG.termYearRequired, "ปี พ.ศ. ต้องเป็นตัวเลข 4 หลัก"),
  cohort: z.string().min(1, MSG.cohortRequired),
  position: z.string().min(1, MSG.positionRequired),
  remarks: z.string().min(1, MSG.remarksRequired),
});

// --- API schemas ---

export const committeeCreateSchema = z.object({
  termYear: z.coerce.number().int("ปี พ.ศ. ต้องเป็นตัวเลข"),
  studentId: z.string().min(1, MSG.studentIdRequired).trim(),
  fullName: z.string().min(1, MSG.fullNameRequired).trim(),
  cohort: z.string().min(1, MSG.cohortRequired).trim(),
  position: z.string().min(1, MSG.positionRequired).trim(),
  remarks: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
});

export const committeeUpdateSchema = z.object({
  termYear: z.coerce.number().int("ปี พ.ศ. ต้องเป็นตัวเลข").optional(),
  studentId: z.string().min(1, MSG.studentIdRequired).trim().optional(),
  fullName: z.string().min(1, MSG.fullNameRequired).trim().optional(),
  cohort: z.string().min(1, MSG.cohortRequired).trim().optional(),
  position: z.string().min(1, MSG.positionRequired).trim().optional(),
  remarks: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
  reason: editReasonField(),
});

export type CommitteeFormData = z.infer<typeof committeeFormSchema>;
export type CommitteeCreateInput = z.infer<typeof committeeCreateSchema>;
export type CommitteeUpdateInput = z.infer<typeof committeeUpdateSchema>;

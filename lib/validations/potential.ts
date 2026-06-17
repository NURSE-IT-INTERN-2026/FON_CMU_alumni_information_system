import { z } from "zod";
import { buddhistYearField, editReasonField } from "./helpers";

const MSG = {
  studentIdRequired: "กรุณาระบุรหัสนักศึกษา",
  fullNameRequired: "กรุณากรอกชื่อ-นามสกุล",
  careerRequired: "กรุณากรอกอาชีพ",
  positionRequired: "กรุณากรอกตำแหน่ง",
};

// --- Form schema (all strings) ---

export const potentialFormSchema = z.object({
  career: z.string().min(1, MSG.careerRequired),
  position: z.string().min(1, MSG.positionRequired),
  recordedYear: buddhistYearField("กรุณากรอกปีที่บันทึก", "ปีต้องเป็นตัวเลข 4 หลัก"),
});

// --- API schemas ---

export const potentialCreateSchema = z.object({
  studentId: z.string().min(1, MSG.studentIdRequired).trim(),
  fullName: z.string().min(1, MSG.fullNameRequired).trim(),
  career: z.string().min(1, MSG.careerRequired).trim(),
  position: z.string().min(1, MSG.positionRequired).trim(),
  recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
});

export const potentialUpdateSchema = z.object({
  studentId: z.string().min(1, MSG.studentIdRequired).trim().optional(),
  fullName: z.string().min(1, MSG.fullNameRequired).trim().optional(),
  career: z.string().min(1, MSG.careerRequired).trim().optional(),
  position: z.string().min(1, MSG.positionRequired).trim().optional(),
  recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข").optional(),
  reason: editReasonField(),
});

export type PotentialFormData = z.infer<typeof potentialFormSchema>;
export type PotentialCreateInput = z.infer<typeof potentialCreateSchema>;
export type PotentialUpdateInput = z.infer<typeof potentialUpdateSchema>;

import { z } from "zod";
import { buddhistYearField, editReasonField } from "./helpers";

const MSG = {
  studentIdRequired: "กรุณาระบุรหัสนักศึกษา",
  fullNameRequired: "กรุณากรอกชื่อ-นามสกุล",
  associationNameRequired: "กรุณากรอกชื่อสมาคม/ชมรม",
  positionRequired: "กรุณากรอกตำแหน่ง",
};

// --- Form schema (all strings) ---

export const associationFormSchema = z.object({
  associationName: z.string().min(1, MSG.associationNameRequired),
  position: z.string().min(1, MSG.positionRequired),
  recordedYear: buddhistYearField("กรุณากรอกปีที่บันทึก", "ปีต้องเป็นตัวเลข 4 หลัก"),
});

// --- API schemas ---

export const associationCreateSchema = z.object({
  studentId: z.string().min(1, MSG.studentIdRequired).trim(),
  fullName: z.string().min(1, MSG.fullNameRequired).trim(),
  associationName: z.string().min(1, MSG.associationNameRequired).trim(),
  position: z.string().min(1, MSG.positionRequired).trim(),
  recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
});

export const associationUpdateSchema = z.object({
  studentId: z.string().min(1, MSG.studentIdRequired).trim().optional(),
  fullName: z.string().min(1, MSG.fullNameRequired).trim().optional(),
  associationName: z.string().min(1, MSG.associationNameRequired).trim().optional(),
  position: z.string().min(1, MSG.positionRequired).trim().optional(),
  recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข").optional(),
  reason: editReasonField(),
});

export type AssociationFormData = z.infer<typeof associationFormSchema>;
export type AssociationCreateInput = z.infer<typeof associationCreateSchema>;
export type AssociationUpdateInput = z.infer<typeof associationUpdateSchema>;

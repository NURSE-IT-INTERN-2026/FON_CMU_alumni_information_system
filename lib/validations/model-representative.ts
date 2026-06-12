import { z } from "zod";

const MSG = {
  studentIdRequired: "กรุณาระบุรหัสนักศึกษา",
  nameRequired: "กรุณากรอกชื่อ",
  cohortRequired: "กรุณากรอกรุ่น",
  generationRequired: "กรุณากรอกลำดับรุ่น",
  generationInvalid: "ลำดับรุ่นต้องเป็นตัวเลข",
};

// --- Form schema (all strings) ---

export const modelRepFormSchema = z.object({
  cohort: z.string().min(1, MSG.cohortRequired),
  generation: z
    .string()
    .min(1, MSG.generationRequired)
    .refine((v) => /^\d+$/.test(v), MSG.generationInvalid),
});

// --- API schemas ---

export const modelRepCreateSchema = z.object({
  studentId: z.string().min(1, MSG.studentIdRequired).trim(),
  name: z.string().min(1, MSG.nameRequired).trim(),
  cohort: z.string().min(1, MSG.cohortRequired).trim(),
  generation: z.coerce.number().int(MSG.generationInvalid),
});

export const modelRepUpdateSchema = z.object({
  studentId: z.string().min(1, MSG.studentIdRequired).trim().optional(),
  name: z.string().min(1, MSG.nameRequired).trim().optional(),
  cohort: z.string().min(1, MSG.cohortRequired).trim().optional(),
  generation: z.coerce.number().int(MSG.generationInvalid).optional(),
});

export type ModelRepFormData = z.infer<typeof modelRepFormSchema>;
export type ModelRepCreateInput = z.infer<typeof modelRepCreateSchema>;
export type ModelRepUpdateInput = z.infer<typeof modelRepUpdateSchema>;

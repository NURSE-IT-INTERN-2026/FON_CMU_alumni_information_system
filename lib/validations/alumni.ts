import { z } from "zod";
import { editReasonField } from "./helpers";

const MSG = {
  studentIdRequired: "กรุณากรอกรหัสนักศึกษา",
  studentIdNumeric: "รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น",
  prefixRequired: "กรุณากรอกคำนำหน้า",
  firstNameRequired: "กรุณากรอกชื่อ",
  maidenLastNameRequired: "กรุณากรอกนามสกุลเดิม",
  degreeLevelRequired: "กรุณาเลือกระดับการศึกษา",
  degreeLevelInvalid: "ระดับการศึกษาไม่ถูกต้อง",
};

export const DEGREE_LEVEL_VALUES = [
  "DOCTORAL",
  "MASTER",
  "BACHELOR",
  "NURSING_ASSISTANT",
  "ASSOCIATE",
] as const;

// --- Form schema (all strings for <input> binding) ---

export const alumniFormSchema = z.object({
  studentId: z
    .string()
    .min(1, MSG.studentIdRequired)
    .regex(/^\d+$/, MSG.studentIdNumeric),
  prefix: z.string().min(1, MSG.prefixRequired),
  firstName: z.string().min(1, MSG.firstNameRequired),
  maidenLastName: z.string().min(1, MSG.maidenLastNameRequired),
  degreeLevel: z.enum(DEGREE_LEVEL_VALUES, {
    message: MSG.degreeLevelRequired,
  }),
  cohort: z.string().optional().default(""),
  newLastName: z.string().optional().default(""),
  province: z.string().optional().default(""),
});

// --- API schemas ---

export const alumniCreateSchema = z.object({
  studentId: z.string().min(1, MSG.studentIdRequired).regex(/^\d+$/, MSG.studentIdNumeric),
  prefix: z.string().min(1, MSG.prefixRequired),
  firstName: z.string().min(1, MSG.firstNameRequired),
  maidenLastName: z.string().min(1, MSG.maidenLastNameRequired),
  degreeLevel: z.enum(DEGREE_LEVEL_VALUES).optional().default("BACHELOR"),
  cohort: z.string().optional().nullable(),
  newLastName: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  currentWorkplace: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  isPotential: z.boolean().optional().default(false),
  isModelRepresentative: z.boolean().optional().default(false),
  softDelete: z.boolean().optional(),
});

export const alumniUpdateSchema = z.object({
  prefix: z.string().min(1, MSG.prefixRequired).optional(),
  firstName: z.string().min(1, MSG.firstNameRequired).optional(),
  maidenLastName: z.string().min(1, MSG.maidenLastNameRequired).optional(),
  degreeLevel: z.enum(DEGREE_LEVEL_VALUES).optional(),
  cohort: z.string().optional().nullable(),
  newLastName: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  currentWorkplace: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  isPotential: z.boolean().optional(),
  isModelRepresentative: z.boolean().optional(),
  reason: editReasonField(),
});

// --- Profile form schema (no studentId — used by alumni profile page) ---

export const profileFormSchema = z.object({
  prefix: z.string().min(1, MSG.prefixRequired),
  firstName: z.string().min(1, MSG.firstNameRequired),
  maidenLastName: z.string().min(1, MSG.maidenLastNameRequired),
  newLastName: z.string().optional().default(""),
  cohort: z.string().optional().default(""),
  degreeLevel: z.string().min(1, MSG.degreeLevelRequired),
  province: z.string().optional().default(""),
  email: z
    .string()
    .optional()
    .default("")
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "รูปแบบอีเมลไม่ถูกต้อง",
    }),
  phone: z.string().optional().default(""),
  currentWorkplace: z.string().optional().default(""),
  country: z.string().optional().default(""),
});

// --- All-alumni edit form schema (includes studentId, relaxed degreeLevel) ---

export const alumniEditFormSchema = profileFormSchema.extend({
  studentId: z
    .string()
    .min(1, MSG.studentIdRequired)
    .regex(/^\d+$/, MSG.studentIdNumeric),
  degreeLevel: z.string().optional().default(""),
});

export type AlumniFormData = z.infer<typeof alumniFormSchema>;
export type AlumniCreateInput = z.infer<typeof alumniCreateSchema>;
export type AlumniUpdateInput = z.infer<typeof alumniUpdateSchema>;
export type ProfileFormData = z.infer<typeof profileFormSchema>;
export type AlumniEditFormData = z.infer<typeof alumniEditFormSchema>;

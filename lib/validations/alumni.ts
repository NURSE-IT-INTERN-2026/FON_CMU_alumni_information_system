import { z } from "zod";
import { editReasonField } from "./helpers";

const MSG = {
  studentIdRequired: "กรุณากรอกรหัสนักศึกษา",
  studentIdNumeric: "รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น",
  firstNameRequired: "กรุณากรอกชื่อ",
  lastNameRequired: "กรุณากรอกนามสกุล",
  birthDateRequired: "กรุณากรอกวันเกิด",
  birthDateFormat: "รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น DDMMYYYY",
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
  prefix: z.string().optional().default(""),
  firstName: z.string().min(1, MSG.firstNameRequired),
  lastName: z.string().min(1, MSG.lastNameRequired),
  // Buddhist-era DDMMYYYY (e.g. 01122540) — matches the alumni-signup format.
  birthDate: z
    .string()
    .min(1, MSG.birthDateRequired)
    .regex(/^\d{8}$/, MSG.birthDateFormat),
  degreeLevel: z.enum(DEGREE_LEVEL_VALUES, {
    message: MSG.degreeLevelRequired,
  }),
  cohort: z.string().optional().default(""),
});

// --- API schemas ---

export const alumniCreateSchema = z.object({
  studentId: z.string().min(1, MSG.studentIdRequired).regex(/^\d+$/, MSG.studentIdNumeric),
  prefix: z.string().optional().default(""),
  firstName: z.string().min(1, MSG.firstNameRequired),
  lastName: z.string().min(1, MSG.lastNameRequired),
  birthDate: z
    .string()
    .regex(/^\d{8}$/, MSG.birthDateFormat)
    .optional()
    .nullable(),
  degreeLevel: z.enum(DEGREE_LEVEL_VALUES).optional().default("BACHELOR"),
  cohort: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  phones: z.array(z.string()).optional().nullable(),
  homeAddress: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  isPotential: z.boolean().optional().default(false),
  isModelRepresentative: z.boolean().optional().default(false),
  softDelete: z.boolean().optional(),
});

export const alumniUpdateSchema = z.object({
  // studentId is editable here (manage-mode edit form). It's the FK that every
  // related table (awards, associations, …) references, so changes must be
  // unique — the PUT /api/alumni/[id] route enforces this (409 on collision)
  // and the DB FK is `ON UPDATE CASCADE`, so related rows follow automatically.
  studentId: z
    .string()
    .min(1, MSG.studentIdRequired)
    .regex(/^\d+$/, MSG.studentIdNumeric)
    .optional(),
  prefix: z.string().optional(),
  firstName: z.string().min(1, MSG.firstNameRequired).optional(),
  lastName: z.string().min(1, MSG.lastNameRequired).optional(),
  degreeLevel: z.enum(DEGREE_LEVEL_VALUES).optional(),
  cohort: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  phones: z.array(z.string()).optional().nullable(),
  homeAddress: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  isPotential: z.boolean().optional(),
  isModelRepresentative: z.boolean().optional(),
  reason: editReasonField(),
});

// --- Profile form schema (no studentId — used by alumni profile page) ---

export const profileFormSchema = z.object({
  prefix: z.string().optional().default(""),
  firstName: z.string().min(1, MSG.firstNameRequired),
  lastName: z.string().min(1, MSG.lastNameRequired),
  cohort: z.string().optional().default(""),
  degreeLevel: z.string().min(1, MSG.degreeLevelRequired),
  email: z
    .string()
    .optional()
    .default("")
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "รูปแบบอีเมลไม่ถูกต้อง",
    }),
  contactEmail: z
    .string()
    .optional()
    .default("")
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "รูปแบบอีเมลไม่ถูกต้อง",
    }),
  phones: z.string().optional().default(""),
  homeAddress: z.string().optional().default(""),
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

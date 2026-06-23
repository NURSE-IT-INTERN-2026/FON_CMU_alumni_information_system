import { z } from "zod";
import { DEGREE_LEVEL_VALUES } from "./alumni";
import { editReasonField } from "./helpers";

const MSG = {
  studentIdRequired: "กรุณากรอกรหัสนักศึกษา",
  studentIdNumeric: "รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น",
  degreeLevelRequired: "กรุณาเลือกระดับการศึกษา",
};

// Form <input> sends "" when empty; coerce that to null, numeric strings to
// numbers, and let anything non-numeric fail validation.
const optionalYear = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().int().positive().nullable(),
);

// --- Add/create schema (POST) ---
export const educationCreateSchema = z.object({
  studentId: z
    .string()
    .min(1, MSG.studentIdRequired)
    .regex(/^\d+$/, MSG.studentIdNumeric),
  degreeLevel: z.enum(DEGREE_LEVEL_VALUES, { message: MSG.degreeLevelRequired }),
  graduationYear: optionalYear,
  major: z.string().trim().nullable().optional(),
  cohort: z.string().trim().nullable().optional(),
  firstName: z.string().trim().nullable().optional(),
  lastName: z.string().trim().nullable().optional(),
});

// --- Update schema (PUT) — all fields optional ---
export const educationUpdateSchema = z.object({
  studentId: z
    .string()
    .min(1, MSG.studentIdRequired)
    .regex(/^\d+$/, MSG.studentIdNumeric)
    .optional(),
  degreeLevel: z.enum(DEGREE_LEVEL_VALUES).optional(),
  graduationYear: optionalYear,
  major: z.string().trim().nullable().optional(),
  cohort: z.string().trim().nullable().optional(),
  firstName: z.string().trim().nullable().optional(),
  lastName: z.string().trim().nullable().optional(),
  reason: editReasonField(),
});

export type EducationCreateInput = z.infer<typeof educationCreateSchema>;
export type EducationUpdateInput = z.infer<typeof educationUpdateSchema>;

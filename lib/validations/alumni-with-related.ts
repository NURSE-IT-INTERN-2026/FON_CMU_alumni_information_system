import { z } from "zod";
import { alumniFormSchema } from "./alumni";
import { awardFormSchema } from "./award";
import { associationFormSchema } from "./association";
import { committeeFormSchema } from "./graduate-committee";
import { potentialFormSchema } from "./potential";
import { modelRepFormSchema } from "./model-representative";
import { abroadAlumniFormSchema } from "./abroad-alumni";
import {
  alumniCreateSchema,
  awardCreateSchema,
  associationCreateSchema,
  committeeCreateSchema,
  potentialCreateSchema,
  modelRepCreateSchema,
  abroadAlumniCreateSchema,
} from ".";

// --- Form schema (composite: alumni core + nested arrays, all strings) ---

export const alumniWithRelatedFormSchema = alumniFormSchema.extend({
  awards: z.array(awardFormSchema).optional().default([]),
  associations: z.array(associationFormSchema).optional().default([]),
  graduateCommittees: z.array(committeeFormSchema).optional().default([]),
  potentials: z.array(potentialFormSchema).optional().default([]),
  modelRepresentatives: z.array(modelRepFormSchema).optional().default([]),
  abroadAlumni: z.array(abroadAlumniFormSchema).optional().default([]),
});

// --- API schema (composite with proper types) ---

export const alumniWithRelatedCreateSchema = alumniCreateSchema.extend({
  awards: z
    .array(
      z.object({
        awardName: z.string().min(1, "กรุณากรอกชื่อรางวัล"),
        awardType: z.string().min(1, "กรุณาเลือกประเภทรางวัล"),
        year: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
        description: z.string().optional().default(""),
      }),
    )
    .optional(),
  associations: z
    .array(
      z.object({
        fullName: z.string().optional(),
        associationName: z.string().min(1, "กรุณากรอกชื่อสมาคม/ชมรม"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
      }),
    )
    .optional(),
  graduateCommittees: z
    .array(
      z.object({
        termYear: z.coerce.number().int("ปี พ.ศ. ต้องเป็นตัวเลข"),
        fullName: z.string().optional(),
        cohort: z.string().min(1, "กรุณากรอกรุ่นที่"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        remarks: z.string().optional().default(""),
      }),
    )
    .optional(),
  potentials: z
    .array(
      z.object({
        fullName: z.string().optional(),
        career: z.string().min(1, "กรุณากรอกอาชีพ"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
      }),
    )
    .optional(),
  modelRepresentatives: z
    .array(
      z.object({
        name: z.string().optional(),
        cohort: z.string().min(1, "กรุณากรอกรุ่น"),
        generation: z.coerce.number().int("ลำดับรุ่นต้องเป็นตัวเลข"),
      }),
    )
    .optional(),
  abroadAlumni: z
    .array(
      z.object({
        cohort: z.string().optional().nullable(),
        prefix: z.string().optional().nullable(),
        thaiName: z.string().optional().nullable(),
        englishName: z.string().optional().nullable(),
        workplace: z.string().optional().nullable(),
        country: z.string().min(1, "กรุณากรอกประเทศ"),
        notes: z.string().optional().nullable(),
        order: z.coerce.number().int("ลำดับต้องเป็นตัวเลข"),
      }),
    )
    .optional(),
});

// --- Update schema (no studentId, no abroadAlumni, required core fields) ---

export const alumniWithRelatedUpdateSchema = z.object({
  prefix: z.string().min(1, "กรุณากรอกคำนำหน้า"),
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  maidenLastName: z.string().min(1, "กรุณากรอกนามสกุลเดิม"),
  degreeLevel: z.enum(["DOCTORAL", "MASTER", "BACHELOR", "NURSING_ASSISTANT", "ASSOCIATE"]).optional().nullable(),
  cohort: z.string().optional().nullable(),
  newLastName: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  currentWorkplace: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  awards: z
    .array(
      z.object({
        awardName: z.string().min(1, "กรุณากรอกชื่อรางวัล"),
        awardType: z.string().min(1, "กรุณาเลือกประเภทรางวัล"),
        year: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
        description: z.string().optional().default(""),
      }),
    )
    .optional()
    .default([]),
  associations: z
    .array(
      z.object({
        fullName: z.string().optional(),
        associationName: z.string().min(1, "กรุณากรอกชื่อสมาคม/ชมรม"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
      }),
    )
    .optional()
    .default([]),
  graduateCommittees: z
    .array(
      z.object({
        termYear: z.coerce.number().int("ปี พ.ศ. ต้องเป็นตัวเลข"),
        fullName: z.string().optional(),
        cohort: z.string().min(1, "กรุณากรอกรุ่นที่"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        remarks: z.string().optional().default(""),
      }),
    )
    .optional()
    .default([]),
  potentials: z
    .array(
      z.object({
        fullName: z.string().optional(),
        career: z.string().min(1, "กรุณากรอกอาชีพ"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
      }),
    )
    .optional()
    .default([]),
  modelRepresentatives: z
    .array(
      z.object({
        name: z.string().optional(),
        cohort: z.string().min(1, "กรุณากรอกรุ่น"),
        generation: z.coerce.number().int("ลำดับรุ่นต้องเป็นตัวเลข"),
      }),
    )
    .optional()
    .default([]),
});

export type AlumniWithRelatedFormData = z.infer<typeof alumniWithRelatedFormSchema>;
export type AlumniWithRelatedCreateInput = z.infer<typeof alumniWithRelatedCreateSchema>;
export type AlumniWithRelatedUpdateInput = z.infer<typeof alumniWithRelatedUpdateSchema>;

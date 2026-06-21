import { z } from "zod";
import { alumniFormSchema, profileFormSchema } from "./alumni";
import { editReasonField } from "./helpers";
import { awardFormSchema } from "./award";
import { associationFormSchema } from "./association";
import { committeeFormSchema } from "./graduate-committee";
import { potentialFormSchema } from "./potential";
import { modelRepFormSchema } from "./model-representative";
import {
  alumniCreateSchema,
  awardCreateSchema,
  associationCreateSchema,
  committeeCreateSchema,
  potentialCreateSchema,
  modelRepCreateSchema,
  alumniAgencyCreateSchema,
} from ".";

// Per-element form schema for an alumni self-editing their abroad info.
// Collects only the real, meaningful AlumniAgency columns the alumni owns;
// identity fields (thaiName/prefix/cohort) are auto-filled server-side from
// the alumni record. NOTE: do NOT reuse alumniAgencyFormSchema — its
// address/university fields aren't real columns.
const alumniAgencyFormSchema = z.object({
  country: z.string().min(1, "กรุณากรอกประเทศ"),
  workplace: z.string().optional().default(""),
  homeAddress: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

// --- Form schema (composite: alumni core + nested arrays, all strings) ---

export const alumniWithRelatedFormSchema = alumniFormSchema.extend({
  awards: z.array(awardFormSchema).optional().default([]),
  associations: z.array(associationFormSchema).optional().default([]),
  graduateCommittees: z.array(committeeFormSchema).optional().default([]),
  potentials: z.array(potentialFormSchema).optional().default([]),
  modelRepresentatives: z.array(modelRepFormSchema).optional().default([]),
  // Abroad section collects only the real AlumniAgency columns the alumni owns;
  // identity (thaiName/prefix/cohort) is auto-filled server-side. NOTE: do NOT
  // reuse alumniAgencyFormSchema — its address/university fields aren't real
  // columns, and it would force the form to collect fields that don't persist.
  alumniAgency: z.array(alumniAgencyFormSchema).optional().default([]),
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
      z.object({        associationName: z.string().min(1, "กรุณากรอกชื่อสมาคม/ชมรม"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
      }),
    )
    .optional(),
  graduateCommittees: z
    .array(
      z.object({
        termYear: z.coerce.number().int("ปี พ.ศ. ต้องเป็นตัวเลข"),        cohort: z.string().min(1, "กรุณากรอกรุ่นที่"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        remarks: z.string().optional().default(""),
      }),
    )
    .optional(),
  potentials: z
    .array(
      z.object({        career: z.string().min(1, "กรุณากรอกอาชีพ"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
      }),
    )
    .optional(),
  modelRepresentatives: z
    .array(
      z.object({        cohort: z.string().min(1, "กรุณากรอกรุ่น"),
        generation: z.coerce.number().int("ลำดับรุ่นต้องเป็นตัวเลข"),
      }),
    )
    .optional(),
  alumniAgency: z
    .array(
      z.object({
        country: z.string().min(1, "กรุณากรอกประเทศ"),
        workplace: z.string().optional().nullable(),
        homeAddress: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        // Identity fields are auto-filled server-side from the alumni record;
        // kept optional so callers that supply them still validate.
        cohort: z.string().optional().nullable(),
        prefix: z.string().optional().nullable(),
      }),
    )
    .optional(),
});

// --- Update schema (no studentId, no alumniAgency, required core fields) ---

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
      z.object({        associationName: z.string().min(1, "กรุณากรอกชื่อสมาคม/ชมรม"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
      }),
    )
    .optional()
    .default([]),
  graduateCommittees: z
    .array(
      z.object({
        termYear: z.coerce.number().int("ปี พ.ศ. ต้องเป็นตัวเลข"),        cohort: z.string().min(1, "กรุณากรอกรุ่นที่"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        remarks: z.string().optional().default(""),
      }),
    )
    .optional()
    .default([]),
  potentials: z
    .array(
      z.object({        career: z.string().min(1, "กรุณากรอกอาชีพ"),
        position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
        recordedYear: z.coerce.number().int("ปีต้องเป็นตัวเลข"),
      }),
    )
    .optional()
    .default([]),
  modelRepresentatives: z
    .array(
      z.object({        cohort: z.string().min(1, "กรุณากรอกรุ่น"),
        generation: z.coerce.number().int("ลำดับรุ่นต้องเป็นตัวเลข"),
      }),
    )
    .optional()
    .default([]),
  reason: editReasonField(),
});

export type AlumniWithRelatedFormData = z.infer<typeof alumniWithRelatedFormSchema>;
export type AlumniWithRelatedCreateInput = z.infer<typeof alumniWithRelatedCreateSchema>;
export type AlumniWithRelatedUpdateInput = z.infer<typeof alumniWithRelatedUpdateSchema>;

// --- Alumni self-service profile (core + all 6 related sections) ---
// Mirrors the admin new-alumni form, but built on profileFormSchema (no
// editable studentId) and extended with abroad using real columns.

export const alumniProfileWithRelatedFormSchema = profileFormSchema.extend({
  awards: z.array(awardFormSchema).optional().default([]),
  associations: z.array(associationFormSchema).optional().default([]),
  graduateCommittees: z.array(committeeFormSchema).optional().default([]),
  potentials: z.array(potentialFormSchema).optional().default([]),
  modelRepresentatives: z.array(modelRepFormSchema).optional().default([]),
  alumniAgency: z.array(alumniAgencyFormSchema).optional().default([]),
});

// Server schema: alumniWithRelatedUpdateSchema already has the core profile
// fields (incl. email/phone/currentWorkplace/country) + the 5 relation arrays;
// we only add abroad (validated permissively — names are auto-filled in-txn,
// so we must NOT route through alumniAgencyCreateSchema which requires a name).
export const alumniProfileUpdateSchema = alumniWithRelatedUpdateSchema.extend({
  alumniAgency: z
    .array(alumniAgencyFormSchema)
    .optional()
    .default([]),
});

export type AlumniProfileWithRelatedFormData = z.infer<
  typeof alumniProfileWithRelatedFormSchema
>;
export type AlumniProfileUpdateInput = z.infer<typeof alumniProfileUpdateSchema>;

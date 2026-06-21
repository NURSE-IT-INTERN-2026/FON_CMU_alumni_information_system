import { z } from "zod";
import { editReasonField } from "./helpers";

const MSG = {
  countryRequired: "กรุณากรอกประเทศ",
  nameRequired: "กรุณากรอกชื่อ-นามสกุล หรือชื่ออังกฤษ",
  addressRequired: "กรุณากรอกที่อยู่",
  universityRequired: "กรุณากรอกมหาวิทยาลัย",
};

// --- Form schema (all strings, for new-alumni expandable section) ---
// Used in the composite alumni-with-related form where context is simpler

export const alumniAgencyFormSchema = z.object({
  address: z.string().min(1, MSG.addressRequired),
  country: z.string().min(1, MSG.countryRequired),
  university: z.string().min(1, MSG.universityRequired),
});

// --- API schemas (full fields matching AlumniAgency Prisma model) ---

export const alumniAgencyCreateSchema = z
  .object({
    cohort: z.string().optional().nullable(),
    prefix: z.string().optional().nullable(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    englishName: z.string().optional().nullable(),
    workplace: z.string().optional().nullable(),
    homeAddress: z.string().optional().nullable(),
    country: z.string().min(1, MSG.countryRequired).trim(),
    notes: z.string().optional().nullable(),
    major: z.string().optional().nullable(),
    studentId: z.string().optional().nullable(),
    order: z.coerce.number().int().optional().default(0),
  })
  .refine((data) => data.firstName || data.lastName || data.englishName, {
    message: MSG.nameRequired,
    path: ["firstName"],
  });

export const alumniAgencyUpdateSchema = z.object({
  cohort: z.string().optional().nullable(),
  prefix: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  englishName: z.string().optional().nullable(),
  workplace: z.string().optional().nullable(),
  homeAddress: z.string().optional().nullable(),
  country: z.string().min(1, MSG.countryRequired).trim().optional(),
  notes: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
  studentId: z.string().optional().nullable(),
  order: z.coerce.number().int().optional(),
  reason: editReasonField(),
});

export type AlumniAgencyFormData = z.infer<typeof alumniAgencyFormSchema>;
export type AlumniAgencyCreateInput = z.infer<typeof alumniAgencyCreateSchema>;
export type AlumniAgencyUpdateInput = z.infer<typeof alumniAgencyUpdateSchema>;

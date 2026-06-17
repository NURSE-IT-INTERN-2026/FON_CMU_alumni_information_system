import { z } from "zod";

const MSG = {
  countryRequired: "กรุณากรอกประเทศ",
  nameRequired: "กรุณากรอกชื่อไทยหรือชื่ออังกฤษ",
  addressRequired: "กรุณากรอกที่อยู่",
  universityRequired: "กรุณากรอกมหาวิทยาลัย",
};

// --- Form schema (all strings, for new-alumni expandable section) ---
// Used in the composite alumni-with-related form where context is simpler

export const abroadAlumniFormSchema = z.object({
  address: z.string().min(1, MSG.addressRequired),
  country: z.string().min(1, MSG.countryRequired),
  university: z.string().min(1, MSG.universityRequired),
});

// --- API schemas (full fields matching AbroadAlumni Prisma model) ---

export const abroadAlumniCreateSchema = z
  .object({
    cohort: z.string().optional().nullable(),
    prefix: z.string().optional().nullable(),
    thaiName: z.string().optional().nullable(),
    englishName: z.string().optional().nullable(),
    workplace: z.string().optional().nullable(),
    homeAddress: z.string().optional().nullable(),
    country: z.string().min(1, MSG.countryRequired).trim(),
    notes: z.string().optional().nullable(),
    order: z.coerce.number().int().optional().default(0),
  })
  .refine((data) => data.thaiName || data.englishName, {
    message: MSG.nameRequired,
    path: ["thaiName"],
  });

export const abroadAlumniUpdateSchema = z.object({
  cohort: z.string().optional().nullable(),
  prefix: z.string().optional().nullable(),
  thaiName: z.string().optional().nullable(),
  englishName: z.string().optional().nullable(),
  workplace: z.string().optional().nullable(),
  homeAddress: z.string().optional().nullable(),
  country: z.string().min(1, MSG.countryRequired).trim().optional(),
  notes: z.string().optional().nullable(),
  order: z.coerce.number().int().optional(),
});

export type AbroadAlumniFormData = z.infer<typeof abroadAlumniFormSchema>;
export type AbroadAlumniCreateInput = z.infer<typeof abroadAlumniCreateSchema>;
export type AbroadAlumniUpdateInput = z.infer<typeof abroadAlumniUpdateSchema>;

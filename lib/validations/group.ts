import { z } from "zod";

/**
 * Community V2 groups. INTEREST groups only via the API — COHORT groups are
 * auto-derived (lib/group-cohort.ts) and cannot be created/edited here.
 */
export const groupCreateSchema = z.object({
  title: z.string().trim().min(2, "ชื่อกลุ่มต้องมีอย่างน้อย 2 ตัวอักษร").max(120, "ชื่อกลุ่มยาวเกินไป"),
  description: z.string().max(2000, "คำอธิบายต้องไม่เกิน 2,000 ตัวอักษร").optional().default(""),
});

export const groupUpdateSchema = groupCreateSchema.partial();

export const GROUP_KIND_VALUES = ["COHORT", "INTEREST"] as const;
export const GROUP_KIND_LABELS: Record<(typeof GROUP_KIND_VALUES)[number], string> = {
  COHORT: "กลุ่มรุ่น",
  INTEREST: "กลุ่มความสนใจ",
};

export type GroupCreateInput = z.infer<typeof groupCreateSchema>;
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>;

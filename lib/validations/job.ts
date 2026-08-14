import { z } from "zod";

/**
 * Community V2 job board. `expiresAt` is a datetime-local string (like
 * events); capped at ≤ 90 days out from "now" — checked against a Date.now()
 * snapshot at parse time via a superRefine in the route-facing schema.
 */
const MSG = {
  titleRequired: "กรุณากรอกตำแหน่งงาน",
  workplaceRequired: "กรุณากรอกสถานที่ทำงาน",
  descRequired: "กรุณากรอกรายละเอียดงาน",
  expiryRequired: "กรุณาระบุวันที่ปิดรับสมัคร",
  expiryFuture: "วันที่ปิดรับสมัครต้องอยู่ในอนาคต",
  expiryTooFar: "วันที่ปิดรับสมัครต้องไม่เกิน 90 วันนับจากวันนี้",
  badLink: "ลิงก์ไม่ถูกต้อง",
};

const TITLE_MAX = 200;
const DESC_MAX = 10000;

const MAX_EXPIRY_DAYS = 90;

export const JOB_SCOPE_VALUES = ["active", "expired", "mine"] as const;
export const JOB_SCOPE_LABELS: Record<string, string> = {
  active: "เปิดรับสมัคร",
  expired: "ปิดรับสมัครแล้ว",
  mine: "ประกาศของฉัน",
};

const jobShape = {
  title: z.string().trim().min(1, MSG.titleRequired).max(TITLE_MAX),
  workplace: z.string().trim().min(1, MSG.workplaceRequired).max(200),
  position: z.string().trim().max(200).optional(),
  province: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  description: z.string().trim().min(1, MSG.descRequired).max(DESC_MAX),
  applyUrl: z
    .string()
    .trim()
    .url(MSG.badLink)
    .optional()
    .or(z.literal("")),
  contactInfo: z.string().trim().max(500).optional(),
  // datetime-local string; the route converts with bangkokDatetimeLocalToIso.
  expiresAt: z.string().min(1, MSG.expiryRequired),
};

function expiryRefine<T extends z.ZodType<{ expiresAt: string }>>(schema: T) {
  return schema.superRefine((v, ctx) => {
    const expiry = new Date(v.expiresAt);
    const now = new Date();
    if (Number.isNaN(expiry.getTime()) || expiry <= now) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG.expiryFuture, path: ["expiresAt"] });
      return;
    }
    const max = new Date(now.getTime() + MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    if (expiry > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG.expiryTooFar, path: ["expiresAt"] });
    }
  });
}

export const jobFormSchema = z.object(jobShape);
export const jobCreateSchema = expiryRefine(z.object(jobShape));
export const jobUpdateSchema = expiryRefine(
  z.object({
    title: jobShape.title.optional(),
    workplace: jobShape.workplace.optional(),
    position: jobShape.position,
    province: jobShape.province,
    country: jobShape.country,
    description: jobShape.description.optional(),
    applyUrl: jobShape.applyUrl,
    contactInfo: jobShape.contactInfo,
    expiresAt: jobShape.expiresAt,
  }),
);

export type JobFormData = z.infer<typeof jobFormSchema>;
export type JobCreateInput = z.infer<typeof jobCreateSchema>;
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;

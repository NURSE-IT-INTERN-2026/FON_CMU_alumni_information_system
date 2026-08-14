import { z } from "zod";

/**
 * Community V2 mentorship (light): mentor volunteering + mentee requests.
 * No matching algorithm — a mentee browses the volunteer list and asks.
 */
const MSG = {
  expertiseRequired: "กรุณากรอกข้อเชี่ยวชาญที่ให้คำปรึกษา",
  badCapacity: "จำนวนผู้ที่รับให้คำปรึกษาต้องอยู่ระหว่าง 1–10",
  messageRequired: "กรุณากรอกข้อความถึงพี่เลี้ยง",
  actionRequired: "กรุณาระบุการดำเนินการ",
};

export const MENTORSHIP_STATUS_VALUES = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"] as const;
export const MENTORSHIP_STATUS_LABELS: Record<string, string> = {
  PENDING: "รอตอบรับ",
  ACCEPTED: "ตอบรับแล้ว",
  DECLINED: "ปฏิเสธแล้ว",
  CANCELLED: "ยกเลิกแล้ว",
};

export const mentorProfileSchema = z.object({
  expertise: z.string().trim().min(1, MSG.expertiseRequired).max(200),
  capacity: z.number().int().min(1, MSG.badCapacity).max(10, MSG.badCapacity).default(1),
  accepting: z.boolean().default(true),
});

export const mentorshipRequestSchema = z.object({
  mentorId: z.string().uuid(),
  message: z.string().trim().min(1, MSG.messageRequired).max(2000),
});

export const mentorshipActionSchema = z.object({
  action: z.enum(["accept", "decline", "cancel"], { message: MSG.actionRequired }),
});

export type MentorProfileInput = z.infer<typeof mentorProfileSchema>;
export type MentorshipRequestInput = z.infer<typeof mentorshipRequestSchema>;
export type MentorshipActionInput = z.infer<typeof mentorshipActionSchema>;

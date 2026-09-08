import { z } from "zod";
import { bangkokDatetimeLocalToIso } from "@/lib/event-format";

const MSG = {
  titleRequired: "กรุณากรอกชื่อกิจกรรม",
  descRequired: "กรุณากรอกรายละเอียดกิจกรรม",
  startRequired: "กรุณาระบุวันเวลาเริ่มกิจกรรม",
  endAfterStart: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น",
  titleTooLong: "ชื่อกิจกรรมต้องไม่เกิน 200 ตัวอักษร",
  descTooLong: "รายละเอียดต้องไม่เกิน 10,000 ตัวอักษร",
  badCapacity: "จำนวนผู้เข้าร่วมสูงสุดต้องมากกว่า 0",
  badGuestLimit: "จำนวนผู้ร่วมเดินทางสูงสุดต้องไม่ติดลบ",
  badGuestCount: "จำนวนผู้ร่วมเดินทางต้องไม่ติดลบ",
  badLink: "ลิงก์ไม่ถูกต้อง",
};

const TITLE_MAX = 200;
const DESC_MAX = 10000;

export const RSVP_STATUS_VALUES = ["ATTENDING", "DECLINED"] as const;
export const RSVP_STATUS_LABELS: Record<string, string> = {
  ATTENDING: "เข้าร่วม",
  DECLINED: "ไม่เข้าร่วม",
};

const titleField = z.string().trim().min(1, MSG.titleRequired).max(TITLE_MAX, MSG.titleTooLong);
const descField = z.string().min(1, MSG.descRequired).max(DESC_MAX, MSG.descTooLong);
// datetime-local strings ("YYYY-MM-DDTHH:mm"); converted to Bangkok ISO in the route.
const startField = z.string().min(1, MSG.startRequired);
const endField = z.string().min(1).optional();
const locationField = z.string().trim().max(500).optional();
const linkField = z
  .string()
  .trim()
  .url(MSG.badLink)
  .optional()
  .or(z.literal(""));
const capacityField = z.number().int().min(1, MSG.badCapacity).optional();
const guestLimitField = z.number().int().min(0, MSG.badGuestLimit).default(0);
const coverField = z.string().optional().nullable();

const eventShape = {
  title: titleField,
  description: descField,
  startAt: startField,
  endAt: endField,
  location: locationField,
  onlineLink: linkField,
  capacity: capacityField,
  guestLimit: guestLimitField,
  coverImageUrl: coverField,
  // Optional group scope (community V2): the group's slug or id. Membership
  // (alumni organizers) is checked by the route.
  groupId: z.string().trim().max(100).optional(),
};

const endAfterStart = z
  .object({ startAt: startField, endAt: endField })
  .refine(
    (v) => !v.endAt || new Date(bangkokDatetimeLocalToIso(v.endAt)) > new Date(bangkokDatetimeLocalToIso(v.startAt)),
    { message: MSG.endAfterStart, path: ["endAt"] },
  );

export const eventFormSchema = z.object(eventShape).merge(endAfterStart);
export const eventCreateSchema = z.object(eventShape).merge(endAfterStart);
export const eventUpdateSchema = z
  .object({
    title: titleField.optional(),
    description: descField.optional(),
    startAt: startField.optional(),
    endAt: endField,
    location: locationField,
    onlineLink: linkField,
    capacity: capacityField,
    guestLimit: guestLimitField.optional(),
    coverImageUrl: coverField,
  })
  .refine(
    (v) =>
      !v.endAt ||
      !v.startAt ||
      new Date(bangkokDatetimeLocalToIso(v.endAt)) > new Date(bangkokDatetimeLocalToIso(v.startAt)),
    { message: MSG.endAfterStart, path: ["endAt"] },
  );

export const rsvpSchema = z.object({
  status: z.enum(RSVP_STATUS_VALUES),
  guestCount: z.number().int().min(0, MSG.badGuestCount).default(0),
});

export type EventFormData = z.infer<typeof eventFormSchema>;
export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;

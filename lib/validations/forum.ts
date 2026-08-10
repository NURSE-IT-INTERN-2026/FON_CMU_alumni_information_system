import { z } from "zod";

const MSG = {
  titleRequired: "กรุณากรอกหัวข้อ",
  bodyRequired: "กรุณากรอกเนื้อหา",
  titleTooLong: "หัวข้อต้องไม่เกิน 200 ตัวอักษร",
  bodyTooLong: "เนื้อหาต้องไม่เกิน 10,000 ตัวอักษร",
  reasonRequired: "กรุณาเลือกเหตุผลในการรายงาน",
  detailTooLong: "รายละเอียดต้องไม่เกิน 1,000 ตัวอักษร",
};

const BODY_MAX = 10000;
const TITLE_MAX = 200;
const DETAIL_MAX = 1000;

// --- Enums (mirror the Prisma enums; safe to redeclare as zod enums) ---

export const FORUM_REPORT_RESOURCE_VALUES = ["FORUM_TOPIC", "FORUM_REPLY", "EVENT"] as const;
export const CONTENT_REPORT_REASON_VALUES = [
  "SPAM",
  "HARASSMENT",
  "INAPPROPRIATE",
  "OTHER",
] as const;
export const CONTENT_REPORT_STATUS_VALUES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export const COMMUNITY_ACTION_VALUES = ["opt-in", "opt-out"] as const;

export const FORUM_REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: "สแปม / โฆษณา",
  HARASSMENT: "คุกคาม / ส่อเสียด",
  INAPPROPRIATE: "เนื้อหาไม่เหมาะสม",
  OTHER: "อื่นๆ",
};

export const CONTENT_REPORT_STATUS_LABELS: Record<string, string> = {
  OPEN: "รอดำเนินการ",
  RESOLVED: "ดำเนินการแก้ไขแล้ว",
  DISMISSED: "ยกเลิก",
};

// List-view sort options (Thai labels on the page; values drive orderBy).
export const FORUM_SORT_VALUES = ["newest", "latest-reply", "most-replies"] as const;
export const FORUM_SORT_LABELS: Record<string, string> = {
  newest: "ใหม่ที่สุด",
  "latest-reply": "ตอบล่าสุด",
  "most-replies": "ตอบมากที่สุด",
};

// --- Topic schemas ---

const titleField = z.string().trim().min(1, MSG.titleRequired).max(TITLE_MAX, MSG.titleTooLong);
const bodyField = z.string().min(1, MSG.bodyRequired).max(BODY_MAX, MSG.bodyTooLong);

export const forumTopicFormSchema = z.object({
  title: titleField,
  body: bodyField,
});

export const forumTopicCreateSchema = z.object({
  title: titleField,
  body: bodyField,
});

export const forumTopicUpdateSchema = z.object({
  title: titleField.optional(),
  body: bodyField.optional(),
});

// --- Reply schemas ---

export const forumReplyFormSchema = z.object({
  body: bodyField,
});

export const forumReplyCreateSchema = z.object({
  body: bodyField,
});

export const forumReplyUpdateSchema = z.object({
  body: bodyField.optional(),
});

// --- Report schema ---

export const forumReportCreateSchema = z.object({
  resourceType: z.enum(FORUM_REPORT_RESOURCE_VALUES),
  resourceId: z.string().uuid(),
  reason: z.enum(CONTENT_REPORT_REASON_VALUES, { message: MSG.reasonRequired }),
  reasonDetail: z.string().max(DETAIL_MAX, MSG.detailTooLong).optional(),
});

export const forumReportActionSchema = z.object({
  action: z.enum(["resolve", "dismiss"]),
  note: z.string().max(DETAIL_MAX, MSG.detailTooLong).optional(),
});

// --- Community membership schema ---

export const communityMembershipSchema = z.object({
  action: z.enum(COMMUNITY_ACTION_VALUES),
});

export type ForumTopicFormData = z.infer<typeof forumTopicFormSchema>;
export type ForumTopicCreateInput = z.infer<typeof forumTopicCreateSchema>;
export type ForumTopicUpdateInput = z.infer<typeof forumTopicUpdateSchema>;
export type ForumReplyFormData = z.infer<typeof forumReplyFormSchema>;
export type ForumReplyCreateInput = z.infer<typeof forumReplyCreateSchema>;
export type ForumReplyUpdateInput = z.infer<typeof forumReplyUpdateSchema>;
export type ForumReportCreateInput = z.infer<typeof forumReportCreateSchema>;
export type ForumReportActionInput = z.infer<typeof forumReportActionSchema>;
export type CommunityMembershipInput = z.infer<typeof communityMembershipSchema>;

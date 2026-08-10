import { z } from "zod";

const MSG = {
  bodyRequired: "กรุณากรอกเนื้อหา",
  bodyTooLong: "เนื้อหาต้องไม่เกิน 10,000 ตัวอักษร",
};

const BODY_MAX = 10000;

const bodyField = z.string().min(1, MSG.bodyRequired).max(BODY_MAX, MSG.bodyTooLong);

// --- Feed post ---

export const feedPostFormSchema = z.object({
  body: bodyField,
  imageUrl: z.string().optional().nullable(),
});

export const feedPostCreateSchema = z.object({
  body: bodyField,
  imageUrl: z.string().optional().nullable(),
});

export const feedPostUpdateSchema = z.object({
  body: bodyField.optional(),
  imageUrl: z.string().optional().nullable(),
});

// --- Feed comment ---

export const feedCommentFormSchema = z.object({ body: bodyField });
export const feedCommentCreateSchema = z.object({ body: bodyField });
export const feedCommentUpdateSchema = z.object({ body: bodyField.optional() });

export type FeedPostFormData = z.infer<typeof feedPostFormSchema>;
export type FeedPostCreateInput = z.infer<typeof feedPostCreateSchema>;
export type FeedPostUpdateInput = z.infer<typeof feedPostUpdateSchema>;
export type FeedCommentFormData = z.infer<typeof feedCommentFormSchema>;
export type FeedCommentCreateInput = z.infer<typeof feedCommentCreateSchema>;
export type FeedCommentUpdateInput = z.infer<typeof feedCommentUpdateSchema>;

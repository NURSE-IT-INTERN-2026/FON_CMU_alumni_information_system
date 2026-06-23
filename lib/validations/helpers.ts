import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * Handle ZodError by returning the first validation message as a 400 response.
 * Used in all API route handlers.
 */
export function handleZodError(error: z.ZodError): NextResponse {
  const firstMessage = error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง";
  return NextResponse.json({ error: firstMessage }, { status: 400 });
}

/**
 * Reusable Buddhist year (พ.ศ.) string field for form schemas.
 * Expects a 4-digit string like "2568".
 */
export function buddhistYearField(
  requiredMsg = "กรุณากรอกปี พ.ศ.",
  invalidMsg = "ปี พ.ศ. ต้องเป็นตัวเลข 4 หลัก",
) {
  return z
    .string()
    .min(1, requiredMsg)
    .refine((v) => /^\d{4}$/.test(v), invalidMsg);
}

/**
 * Email field with format validation.
 */
export function emailField(msg = "รูปแบบอีเมลไม่ถูกต้อง") {
  return z.string().email(msg);
}

/**
 * Optional edit-reason field. The แก้ไข/อัพเดท selector was removed — edits no
 * longer capture or require a reason — so this is now an optional free string.
 * Kept so update schemas still expose `reason` (routes thread it through to the
 * activity log when present, null otherwise).
 */
export function editReasonField() {
  return z.string().trim().nullable().optional();
}

/**
 * Password field with length constraints.
 * Prevents bcrypt DoS by capping at 128 chars.
 */
export function passwordField(
  minMsg = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  maxMsg = "รหัสผ่านต้องไม่เกิน 128 ตัวอักษร",
  minLength = 8,
) {
  return z.string().min(minLength, minMsg).max(128, maxMsg);
}

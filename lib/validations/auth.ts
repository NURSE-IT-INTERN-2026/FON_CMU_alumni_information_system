import { z } from "zod";
import { passwordField } from "./helpers";

// --- Admin login (email + password, CMU domain) ---

export const adminLoginSchema = z.object({
  email: z
    .string()
    .min(1, "กรุณากรอกอีเมล")
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .refine((e) => e.endsWith("@cmu.ac.th"), "กรุณาใช้อีเมล @cmu.ac.th"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

// --- Alumni login (email + password, any domain) ---

export const alumniLoginSchema = z.object({
  email: z.string().min(1, "กรุณากรอกอีเมล").email("รูปแบบอีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

// --- Alumni signup ---

export const alumniSignupSchema = z
  .object({
    studentId: z.string().min(1, "กรุณากรอกรหัสนักศึกษา"),
    degreeLevel: z.string().min(1, "กรุณาเลือกระดับการศึกษา"),
    cohort: z.string().min(1, "กรุณากรอกปีที่จบ"),
    firstName: z.string().min(1, "กรุณากรอกชื่อ"),
    lastName: z.string().min(1, "กรุณากรอกนามสกุลเดิม"),
    birthDate: z
      .string()
      .min(1, "กรุณากรอกวันเกิด")
      .regex(/^\d{8}$/, "รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น DDMMYYYY"),
    email: z.string().min(1, "กรุณากรอกอีเมล").email("รูปแบบอีเมลไม่ถูกต้อง"),
    password: passwordField(),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่าน"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });

// --- Alumni re-apply (rejected → resubmit to the admin queue) ---
// Covers the editable identity fields shown pre-filled in step 2. Email +
// password (identity proof) are collected in step 1 and validated server-side
// by /api/alumni-auth/reapply(+/prepare); they aren't part of this form schema.

export const alumniReapplySchema = z.object({
  studentId: z.string().min(1, "กรุณากรอกรหัสนักศึกษา"),
  degreeLevel: z.string().min(1, "กรุณาเลือกระดับการศึกษา"),
  cohort: z.string().min(1, "กรุณากรอกปีที่จบ"),
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุลเดิม"),
  birthDate: z
    .string()
    .min(1, "กรุณากรอกวันเกิด")
    .regex(/^\d{8}$/, "รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น DDMMYYYY"),
});

// --- Forgot password ---

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "กรุณากรอกอีเมล").email("รูปแบบอีเมลไม่ถูกต้อง"),
});

// --- Reset password ---

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "โทเคนไม่ถูกต้อง"),
    password: passwordField(),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่าน"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });

// --- Email verification (signup email-ownership confirmation) ---

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "โทเคนไม่ถูกต้อง"),
});

export const resendVerificationSchema = z.object({
  email: z.string().min(1, "กรุณากรอกอีเมล").email("รูปแบบอีเมลไม่ถูกต้อง"),
});

export type AdminLoginData = z.infer<typeof adminLoginSchema>;
export type AlumniLoginData = z.infer<typeof alumniLoginSchema>;
export type AlumniSignupData = z.infer<typeof alumniSignupSchema>;
export type AlumniReapplyData = z.infer<typeof alumniReapplySchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailData = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationData = z.infer<typeof resendVerificationSchema>;

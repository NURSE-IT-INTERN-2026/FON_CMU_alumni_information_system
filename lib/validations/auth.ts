import { z } from "zod";
import { emailField, passwordField } from "./helpers";

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

export type AdminLoginData = z.infer<typeof adminLoginSchema>;
export type AlumniLoginData = z.infer<typeof alumniLoginSchema>;
export type AlumniSignupData = z.infer<typeof alumniSignupSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

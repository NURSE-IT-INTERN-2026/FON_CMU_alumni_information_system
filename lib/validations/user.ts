import { z } from "zod";

const MSG = {
  firstNameRequired: "กรุณากรอกชื่อ",
  lastNameRequired: "กรุณากรอกนามสกุล",
  emailRequired: "กรุณากรอกอีเมล",
  emailInvalid: "รูปแบบอีเมลไม่ถูกต้อง",
  emailCmuOnly: "กรุณาใช้อีเมล @cmu.ac.th",
  roleInvalid: "บทบาทไม่ถูกต้อง",
};

export const USER_ROLE_VALUES = ["superadmin", "admin", "executive"] as const;

// --- API schemas ---

export const userCreateSchema = z.object({
  firstName: z.string().min(1, MSG.firstNameRequired),
  lastName: z.string().min(1, MSG.lastNameRequired),
  email: z
    .string()
    .min(1, MSG.emailRequired)
    .email(MSG.emailInvalid)
    .refine((e) => e.endsWith("@cmu.ac.th"), MSG.emailCmuOnly),
  role: z.enum(USER_ROLE_VALUES).optional().default("admin"),
});

export const userUpdateSchema = z.object({
  firstName: z.string().min(1, MSG.firstNameRequired).optional(),
  lastName: z.string().min(1, MSG.lastNameRequired).optional(),
  email: z
    .string()
    .min(1, MSG.emailRequired)
    .email(MSG.emailInvalid)
    .refine((e) => e.endsWith("@cmu.ac.th"), MSG.emailCmuOnly)
    .optional(),
  role: z.enum(USER_ROLE_VALUES).optional(),
  isActive: z.boolean().optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

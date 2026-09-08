import { describe, expect, it } from "vitest";
import { jobCreateSchema } from "@/lib/validations/job";

describe("job zod schemas", () => {
  it("jobCreateSchema requires a future expiry, with no upper cap", () => {
    const job = { title: "พยาบาลวิชาชีพ", workplace: "รพ. ทดสอบ", description: "รับสมัคร" };
    const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 16);
    expect(jobCreateSchema.safeParse({ ...job, expiresAt: days(30) }).success).toBe(true);
    expect(jobCreateSchema.safeParse({ ...job, expiresAt: days(-1) }).success).toBe(false);
    expect(jobCreateSchema.safeParse({ ...job, expiresAt: days(91) }).success).toBe(true);
    expect(jobCreateSchema.safeParse({ ...job, expiresAt: days(3650) }).success).toBe(true);
  });
});

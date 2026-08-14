import { describe, expect, it } from "vitest";
import { checkTransition, transitionResult } from "@/lib/mentorship-flow";
import { mentorProfileSchema, mentorshipRequestSchema, mentorshipActionSchema } from "@/lib/validations/mentorship";
import { jobCreateSchema } from "@/lib/validations/job";

describe("checkTransition — mentorship state rules", () => {
  it("mentor can accept/decline a PENDING request", () => {
    expect(checkTransition("PENDING", "accept", true, false).ok).toBe(true);
    expect(checkTransition("PENDING", "decline", true, false).ok).toBe(true);
  });

  it("mentee can cancel their PENDING request", () => {
    expect(checkTransition("PENDING", "cancel", false, true).ok).toBe(true);
  });

  it("mentee cannot accept/decline; mentor cannot cancel", () => {
    expect(checkTransition("PENDING", "accept", false, true).ok).toBe(false);
    expect(checkTransition("PENDING", "cancel", true, false).ok).toBe(false);
  });

  it("an outsider cannot do anything", () => {
    for (const action of ["accept", "decline", "cancel"] as const) {
      expect(checkTransition("PENDING", action, false, false).ok).toBe(false);
    }
  });

  it("an already-answered request rejects further actions", () => {
    expect(checkTransition("ACCEPTED", "accept", true, false).ok).toBe(false);
    expect(checkTransition("DECLINED", "accept", true, false).ok).toBe(false);
    expect(checkTransition("ACCEPTED", "cancel", false, true).ok).toBe(false);
  });

  it("transitionResult maps actions to statuses", () => {
    expect(transitionResult("accept")).toBe("ACCEPTED");
    expect(transitionResult("decline")).toBe("DECLINED");
    expect(transitionResult("cancel")).toBe("CANCELLED");
  });
});

describe("mentorship + job zod schemas", () => {
  it("mentorProfileSchema bounds capacity 1–10", () => {
    expect(mentorProfileSchema.safeParse({ expertise: "ผู้สูงอายุ", capacity: 0 }).success).toBe(false);
    expect(mentorProfileSchema.safeParse({ expertise: "ผู้สูงอายุ", capacity: 11 }).success).toBe(false);
    expect(mentorProfileSchema.safeParse({ expertise: "ผู้สูงอายุ", capacity: 3, accepting: false }).success).toBe(true);
  });

  it("mentorshipRequestSchema requires a uuid mentor + message", () => {
    expect(mentorshipRequestSchema.safeParse({ mentorId: "not-a-uuid", message: "สวัสดี" }).success).toBe(false);
    expect(
      mentorshipRequestSchema.safeParse({ mentorId: "2fe4baca-c25c-4e40-8dd0-612123f2f555", message: "" }).success,
    ).toBe(false);
  });

  it("mentorshipActionSchema accepts only the three actions", () => {
    expect(mentorshipActionSchema.safeParse({ action: "accept" }).success).toBe(true);
    expect(mentorshipActionSchema.safeParse({ action: "nuke" }).success).toBe(false);
  });

  it("jobCreateSchema caps expiry at 90 days and requires the future", () => {
    const job = { title: "พยาบาลวิชาชีพ", workplace: "รพ. ทดสอบ", description: "รับสมัคร" };
    const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 16);
    expect(jobCreateSchema.safeParse({ ...job, expiresAt: days(30) }).success).toBe(true);
    expect(jobCreateSchema.safeParse({ ...job, expiresAt: days(-1) }).success).toBe(false);
    expect(jobCreateSchema.safeParse({ ...job, expiresAt: days(91) }).success).toBe(false);
  });
});

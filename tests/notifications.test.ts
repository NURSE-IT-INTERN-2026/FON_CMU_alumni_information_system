import { describe, expect, it, vi, beforeEach } from "vitest";
import { notificationLink, notificationText } from "@/lib/notification-text";
import { GROUP_NOTIFY_CAP } from "@/lib/notification-emitter";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

const actor: AlumniPublicIdentity = {
  id: "a-1",
  prefix: "นางสาว",
  firstName: "สมหญิง",
  lastName: "รักเรียน",
  cohort: "52",
  degreeLevel: "BACHELOR",
  photoUrl: null,
};

describe("notificationText — Thai snapshots", () => {
  it("prefixes the actor name where there is one", () => {
    expect(notificationText("REPLY_TO_MY_TOPIC", { actor, topicTitle: "เรื่องนี้" }).title).toBe(
      "นางสาวสมหญิง รักเรียน ตอบกระทู้ของคุณ",
    );
    expect(notificationText("LIKE_ON_MY_POST", { actor }).title).toContain("ถูกใจโพสต์ของคุณ");
  });

  it("falls back to an actor-less title", () => {
    expect(notificationText("REPLY_TO_MY_TOPIC", {}).title).toBe("กระทู้ของคุณมีความคิดเห็นใหม่");
  });

  it("REPORT_OUTCOME distinguishes resolved vs dismissed", () => {
    expect(notificationText("REPORT_OUTCOME", { outcome: "RESOLVED" }).title).toContain("ดำเนินการแล้ว");
    expect(notificationText("REPORT_OUTCOME", { outcome: "DISMISSED" }).title).toContain("ยกเลิก");
  });
});

describe("notificationLink — route mapping", () => {
  it("points types at their pages (basePath added at render, not here)", () => {
    expect(notificationLink("REPLY_TO_MY_TOPIC", "t1")).toBe("/graduates/forum/t1");
    expect(notificationLink("COMMENT_ON_MY_POST", "p1")).toBe("/graduates/feed/p1");
    expect(notificationLink("RSVP_ON_MY_EVENT", "e1")).toBe("/graduates/events/e1");
    expect(notificationLink("MENTORSHIP_REQUEST")).toBe("/graduates/mentorship");
    expect(notificationLink("REPORT_OUTCOME")).toBeNull();
  });
});

// --- Emitter behavior with a mocked prisma --- //
vi.mock("@/lib/prisma", () => ({
  default: {
    notification: { create: vi.fn(), createMany: vi.fn() },
  },
}));

const prisma = (await import("@/lib/prisma")).default;
const { emitNotification, emitToGroupMembers } = await import("@/lib/notification-emitter");

describe("emitNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips self-notifications", async () => {
    await emitNotification({ alumniId: "a-1", type: "LIKE_ON_MY_POST", skipAlumniId: "a-1" });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("creates a row with pre-rendered title + link", async () => {
    await emitNotification({ alumniId: "a-2", type: "REPLY_TO_MY_TOPIC", entityId: "t1", actor, topicTitle: "เรื่อง" });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alumniId: "a-2",
        type: "REPLY_TO_MY_TOPIC",
        entityId: "t1",
        link: "/graduates/forum/t1",
      }),
    });
  });

  it("suppresses DB failures (never throws)", async () => {
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    await expect(
      emitNotification({ alumniId: "a-2", type: "LIKE_ON_MY_POST" }),
    ).resolves.toBeUndefined();
  });
});

describe("emitToGroupMembers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips groups above GROUP_NOTIFY_CAP and empty groups", async () => {
    const many = Array.from({ length: GROUP_NOTIFY_CAP + 1 }, (_, i) => `m-${i}`);
    await emitToGroupMembers({ groupId: "g", memberIds: many, type: "NEW_GROUP_TOPIC", skipAlumniId: null });
    await emitToGroupMembers({ groupId: "g", memberIds: [], type: "NEW_GROUP_TOPIC", skipAlumniId: null });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("filters the actor and createMany-s the rest", async () => {
    await emitToGroupMembers({
      groupId: "g",
      memberIds: ["a-1", "a-2", "a-3"],
      type: "NEW_GROUP_TOPIC",
      entityId: "t9",
      skipAlumniId: "a-1",
    });
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    const arg = (prisma.notification.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.data.map((d: { alumniId: string }) => d.alumniId).sort()).toEqual(["a-2", "a-3"]);
  });

  it("chunks createMany at 500 rows", async () => {
    const many = Array.from({ length: GROUP_NOTIFY_CAP }, (_, i) => `m-${i}`);
    await emitToGroupMembers({ groupId: "g", memberIds: many, type: "NEW_GROUP_TOPIC", skipAlumniId: "m-0" });
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1); // 199 rows < 500
  });
});

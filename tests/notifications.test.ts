import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
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
    expect(notificationLink("REPORT_OUTCOME")).toBeNull();
  });
});

// --- Static guard: next/link auto-prepends basePath — never prefix manually --- //
// The app runs under `basePath: "/alumni"`; `next/link` hrefs and
// `router.push/replace` get the prefix automatically, so a manual
// `${BASE_PATH}` produces `/alumni/alumni/...` → 404 (notification-center bug,
// fixed 2026-09). Manual prefixes are ONLY correct on raw `<a href>`,
// `window.location`, and plain `fetch` — this scan flags just the auto-prefix
// surfaces so those stay untouched.
const LINK_BASEPATH_RE = /<Link\b[^>]*href=\{`\$\{BASE_PATH\}/;
const ROUTER_BASEPATH_RE = /router\.(push|replace)\(`\$\{BASE_PATH\}/;

function listSourceFiles(root: string): string[] {
  return fs
    .readdirSync(root, { recursive: true })
    .map((p) => String(p))
    .filter((p) => /\.(tsx|ts)$/.test(p))
    .map((p) => path.join(root, p).split(path.sep).join("/"));
}

describe("no double basePath on next/link hrefs (static scan)", () => {
  const roots = ["app", "components"].map((r) => path.resolve(process.cwd(), r));
  const files = roots.flatMap(listSourceFiles);

  it("found the source directories (sanity)", () => {
    expect(files.length, "expected to discover app/components source files").toBeGreaterThan(0);
  });

  it("never manually prefixes a next/link href or router.push with BASE_PATH", () => {
    const offenders = files.filter((f) => {
      const content = fs.readFileSync(f, "utf8");
      return LINK_BASEPATH_RE.test(content) || ROUTER_BASEPATH_RE.test(content);
    });
    expect(offenders, "next/link auto-prepends basePath — remove the manual ${BASE_PATH}").toEqual([]);
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

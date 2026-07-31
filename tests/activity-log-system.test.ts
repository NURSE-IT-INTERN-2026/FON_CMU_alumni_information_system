import { describe, it, expect, beforeEach, vi } from "vitest";

// Regression test for security #11: logActivity supports a SYSTEM actor (used
// by the CMU_SYNC_SECRET cron path). The DB enum + nullable identity columns +
// the logs-page readers already expected SYSTEM; this locks the write shape.
const createMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  default: { activityLog: { create: createMock } },
}));

const prisma = (await import("@/lib/prisma")).default;
const { logActivity } = await import("@/lib/activity-log");

describe("logActivity — SYSTEM actor (security #11)", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({ id: "log-1" });
  });

  it("writes a SYSTEM row with no identity columns", async () => {
    const id = await logActivity(
      { actorType: "SYSTEM" },
      "IMPORT",
      "cmu_alumni",
      null,
      { count: 1 },
    );
    expect(id).toBe("log-1");
    expect(prisma.activityLog.create).toHaveBeenCalledTimes(1);
    const data = (
      prisma.activityLog.create as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.data.actorType).toBe("SYSTEM");
    expect(data.data.userId).toBeUndefined();
    expect(data.data.userEmail).toBeUndefined();
    expect(data.data.userRole).toBeUndefined();
    expect(data.data.alumniId).toBeUndefined();
    expect(data.data.alumniName).toBeUndefined();
  });

  it("still writes ADMIN rows unchanged (no regression)", async () => {
    await logActivity(
      { actorType: "ADMIN", userId: "u1", userEmail: "a@x", userRole: "superadmin" },
      "LOGIN",
      "user",
      "u1",
      { method: "password" },
    );
    const data = (
      prisma.activityLog.create as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.data.actorType).toBe("ADMIN");
    expect(data.data.userId).toBe("u1");
    expect(data.data.userRole).toBe("superadmin");
  });
});

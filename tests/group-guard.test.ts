// @vitest-environment node
/**
 * Guards for community V2 groups (lib/group-guard.ts). resolveGroupReader
 * mirrors the forum reader (staff OR opted-in alum); requireGroupMember
 * additionally requires a GroupMembership row (403 {code:"NOT_A_MEMBER"}).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  getAlumniSession: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    communityGroup: { findFirst: vi.fn() },
    groupMembership: { findUnique: vi.fn() },
  },
}));

const { getSession, getAlumniSession } = await import("@/lib/auth");
const prisma = (await import("@/lib/prisma")).default;
const { resolveGroupReader, requireGroupMember } = await import("@/lib/group-guard");

/* eslint-disable @typescript-eslint/no-explicit-any */
const optedInAlumni = {
  id: "a-1",
  communityOptedInAt: new Date("2026-01-01"),
  prefix: "นางสาว",
  firstName: "สมหญิง",
  lastName: "รักเรียน",
} as any;
const notOptedInAlumni = { ...optedInAlumni, id: "a-2", communityOptedInAt: null } as any;
const staffSession = { user: { id: "u-1", email: "admin@cmu.ac.th", role: "admin" } } as any;

function mockAuth(opts: { staff?: any | null; alumni?: any | null }) {
  (getSession as any).mockResolvedValue(opts.staff ?? null);
  (getAlumniSession as any).mockResolvedValue(opts.alumni ? { alumni: opts.alumni } : null);
}

describe("resolveGroupReader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when anonymous", async () => {
    mockAuth({});
    const r = await resolveGroupReader();
    expect("error" in r && r.error.status).toBe(401);
  });

  it("lets staff through (opt-in exempt — moderation)", async () => {
    mockAuth({ staff: staffSession });
    const r = await resolveGroupReader();
    expect("error" in r).toBe(false);
    expect("staff" in r && r.staff).toBe(staffSession);
  });

  it("lets an opted-in alumni through", async () => {
    mockAuth({ alumni: optedInAlumni });
    const r = await resolveGroupReader();
    expect("error" in r).toBe(false);
    expect("alumni" in r && r.alumni?.id).toBe("a-1");
  });

  it("403 NOT_OPTED_IN for a non-opted-in alumni", async () => {
    mockAuth({ alumni: notOptedInAlumni });
    const r = await resolveGroupReader();
    expect("error" in r && r.error.status).toBe(403);
    expect("error" in r && (await r.error.json()).code).toBe("NOT_OPTED_IN");
  });
});

describe("requireGroupMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when anonymous", async () => {
    mockAuth({});
    const r = await requireGroupMember("g-1");
    expect("error" in r && r.error.status).toBe(401);
  });

  it("403 NOT_OPTED_IN when not opted in", async () => {
    mockAuth({ alumni: notOptedInAlumni });
    const r = await requireGroupMember("g-1");
    expect("error" in r && r.error.status).toBe(403);
    expect("error" in r && (await r.error.json()).code).toBe("NOT_OPTED_IN");
  });

  it("403 NOT_A_MEMBER when the alum has no membership row", async () => {
    mockAuth({ alumni: optedInAlumni });
    (prisma.groupMembership.findUnique as any).mockResolvedValue(null);
    const r = await requireGroupMember("g-1");
    expect("error" in r && r.error.status).toBe(403);
    expect("error" in r && (await r.error.json()).code).toBe("NOT_A_MEMBER");
  });

  it("returns the alumni when a member", async () => {
    mockAuth({ alumni: optedInAlumni });
    (prisma.groupMembership.findUnique as any).mockResolvedValue({
      groupId: "g-1",
      alumniId: "a-1",
      role: "MEMBER",
    });
    const r = await requireGroupMember("g-1");
    expect("error" in r).toBe(false);
    expect(!("error" in r) && r.alumni.id).toBe("a-1");
  });
});

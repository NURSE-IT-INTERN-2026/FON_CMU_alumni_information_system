// @vitest-environment node
/**
 * Event gates (lib/event-guard.ts). The KEY difference from the forum: events
 * are a BROADCAST — every ACTIVE alum can READ (no opt-in gate), and any alum
 * can RSVP. Only CREATION requires consent (an opted-in alum) or a staff member.
 * We mock auth + permissions so the real gate logic runs.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  getAlumniSession: vi.fn(),
}));
vi.mock("@/lib/permissions", () => ({
  checkWritePermission: vi.fn(),
}));

const { getSession, getAlumniSession } = await import("@/lib/auth");
const { checkWritePermission } = await import("@/lib/permissions");
const { resolveEventReader, resolveEventCreator } = await import("@/lib/event-guard");

/* eslint-disable @typescript-eslint/no-explicit-any */
const optedInAlumni = { id: "a-1", communityOptedInAt: new Date("2026-01-01"), prefix: "นาย", firstName: "ก", lastName: "ข" } as any;
const notOptedInAlumni = { ...optedInAlumni, id: "a-2", communityOptedInAt: null } as any;
const staffSession = { user: { id: "u-1", email: "admin@cmu.ac.th", role: "admin" } } as any;

function mockAuth(opts: { staff?: any | null; alumni?: any | null }) {
  (getSession as any).mockResolvedValue(opts.staff ?? null);
  (getAlumniSession as any).mockResolvedValue(opts.alumni ? { alumni: opts.alumni } : null);
}
beforeEach(() => {
  vi.clearAllMocks();
  (checkWritePermission as any).mockResolvedValue(null); // staff write OK by default
});

async function status(r: Awaited<ReturnType<typeof resolveEventReader>>) {
  return "error" in r ? r.error.status : 200;
}

describe("resolveEventReader (broadcast — no opt-in gate)", () => {
  it("401 when anonymous", async () => {
    mockAuth({});
    expect(await status(await resolveEventReader())).toBe(401);
  });

  it("lets staff through", async () => {
    mockAuth({ staff: staffSession });
    const r = await resolveEventReader();
    expect("error" in r).toBe(false);
    expect("staff" in r && r.staff).toBeTruthy();
  });

  it("lets an OPTED-IN alumni through", async () => {
    mockAuth({ alumni: optedInAlumni });
    const r = await resolveEventReader();
    expect("error" in r).toBe(false);
    expect("alumni" in r && r.alumni?.id).toBe("a-1");
  });

  it("ALSO lets a NON-opted-in alumni through (broadcast — unlike the forum's 403)", async () => {
    mockAuth({ alumni: notOptedInAlumni });
    const r = await resolveEventReader();
    expect("error" in r).toBe(false);
    expect("alumni" in r && r.alumni?.id).toBe("a-2");
  });
});

describe("resolveEventCreator (staff OR opted-in alumni)", () => {
  it("401 when anonymous", async () => {
    mockAuth({});
    const r = await resolveEventCreator();
    expect("error" in r && r.error.status).toBe(401);
  });

  it("lets staff through (checkWritePermission OK)", async () => {
    mockAuth({ staff: staffSession });
    const r = await resolveEventCreator();
    expect("error" in r).toBe(false);
    expect(!("error" in r) && "staff" in r && r.staff).toBeTruthy();
  });

  it("lets an opted-in alumni through", async () => {
    mockAuth({ alumni: optedInAlumni });
    const r = await resolveEventCreator();
    expect("error" in r).toBe(false);
    expect(!("error" in r) && "alumni" in r && r.alumni.id).toBe("a-1");
  });

  it("403 NOT_OPTED_IN for a non-opted-in alumni", async () => {
    mockAuth({ alumni: notOptedInAlumni });
    const r = await resolveEventCreator();
    expect("error" in r && r.error.status).toBe(403);
    expect("error" in r && (await r.error.json()).code).toBe("NOT_OPTED_IN");
  });
});

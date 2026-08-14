// @vitest-environment node
/**
 * Opt-in gate for the alumni community forum (lib/forum-guard.ts).
 *
 * A forum reader = staff (any role, exempt from opt-in) OR an opted-in alumni.
 * A forum writer = an opted-in alumni only. Anonymous → 401; a non-opted-in
 * alumni → 403 { code: "NOT_OPTED_IN" }. We mock the auth helpers so the real
 * gate logic (the architectural crux) is exercised directly.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  getAlumniSession: vi.fn(),
}));

const { getSession, getAlumniSession } = await import("@/lib/auth");
const {
  resolveForumReader,
  requireForumAlumni,
} = await import("@/lib/forum-guard");

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

async function status(r: Awaited<ReturnType<typeof resolveForumReader>>) {
  return "error" in r ? r.error.status : 200;
}
async function body(r: Awaited<ReturnType<typeof resolveForumReader>>) {
  return "error" in r ? await r.error.json() : null;
}

describe("resolveForumReader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when anonymous", async () => {
    mockAuth({});
    expect(await status(await resolveForumReader())).toBe(401);
  });

  it("lets staff through (opt-in exempt)", async () => {
    mockAuth({ staff: staffSession });
    const r = await resolveForumReader();
    expect("error" in r).toBe(false);
    expect("staff" in r && r.staff).toBe(staffSession);
  });

  it("lets an opted-in alumni through", async () => {
    mockAuth({ alumni: optedInAlumni });
    const r = await resolveForumReader();
    expect("error" in r).toBe(false);
    expect("alumni" in r && r.alumni?.id).toBe("a-1");
  });

  it("403 NOT_OPTED_IN for a non-opted-in alumni", async () => {
    mockAuth({ alumni: notOptedInAlumni });
    const r = await resolveForumReader();
    expect(await status(r)).toBe(403);
    expect((await body(r))?.code).toBe("NOT_OPTED_IN");
  });

  it("staff wins over a non-opted-in alumni session", async () => {
    mockAuth({ staff: staffSession, alumni: notOptedInAlumni });
    const r = await resolveForumReader();
    expect("error" in r).toBe(false);
    expect("staff" in r && r.staff).toBeTruthy();
  });
});

describe("requireForumAlumni", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 when anonymous", async () => {
    mockAuth({});
    const r = await requireForumAlumni();
    expect("error" in r && r.error.status).toBe(401);
  });

  it("403 NOT_OPTED_IN when not opted in", async () => {
    mockAuth({ alumni: notOptedInAlumni });
    const r = await requireForumAlumni();
    expect("error" in r && r.error.status).toBe(403);
    expect("error" in r && (await r.error.json()).code).toBe("NOT_OPTED_IN");
  });

  it("returns the alumni when opted in", async () => {
    mockAuth({ alumni: optedInAlumni });
    const r = await requireForumAlumni();
    expect("error" in r).toBe(false);
    expect(!("error" in r) && r.alumni.id).toBe("a-1");
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Regression test for security #12: the read-only `executive` role must NOT be
// able to mutate education records. Mocks an executive staff session + a prisma
// education row so the [id] PUT/DELETE reach resolveWriter, then asserts 403.
const executiveSession = {
  user: { id: "u-exec", email: "exec@cmu.ac.th", role: "executive" },
};

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSession: (vi.fn(async () => executiveSession) as unknown) as typeof actual.getSession,
  };
});

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue("log-id"),
}));

const educationFindUnique = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  default: {
    education: {
      findUnique: educationFindUnique,
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const prisma = (await import("@/lib/prisma")).default;
const { PUT: putEdu, DELETE: deleteEdu } = await import("@/app/api/educations/[id]/route");
const { POST: postEdu } = await import("@/app/api/alumni/[id]/educations/route");

const BASE = "http://localhost/alumni";
const ID = "00000000-0000-0000-0000-000000000000";
const req = (p: string, init?: RequestInit) => new NextRequest(`${BASE}${p}`, init);
const ctx = () => ({ params: Promise.resolve({ id: ID }) });

describe("executive cannot mutate educations (security #12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    educationFindUnique.mockResolvedValue({
      id: ID,
      alumniId: "a1",
      studentId: "s1",
    });
  });

  it("PUT /api/educations/[id] → 403 for executive (no update)", async () => {
    const res = await putEdu(
      req(`/api/educations/${ID}`, {
        method: "PUT",
        body: JSON.stringify({ studentId: "s1" }),
      }),
      ctx(),
    );
    expect(res.status).toBe(403);
    expect(prisma.education.update).not.toHaveBeenCalled();
  });

  it("DELETE /api/educations/[id] → 403 for executive (no delete)", async () => {
    const res = await deleteEdu(req(`/api/educations/${ID}`, { method: "DELETE" }), ctx());
    expect(res.status).toBe(403);
    expect(prisma.education.delete).not.toHaveBeenCalled();
  });

  it("POST /api/alumni/[id]/educations → 403 for executive (no create)", async () => {
    const res = await postEdu(
      req(`/api/alumni/${ID}/educations`, {
        method: "POST",
        body: JSON.stringify({ studentId: "s1", degreeLevel: "BACHELOR" }),
      }),
      ctx(),
    );
    expect(res.status).toBe(403);
    expect(prisma.education.create).not.toHaveBeenCalled();
  });
});

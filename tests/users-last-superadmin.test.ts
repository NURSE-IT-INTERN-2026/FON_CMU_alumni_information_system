import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Regression test for security #10: demoting/deactivating/deleting the last
// active superadmin must be rejected (availability lockout). The acting user is
// mocked as a superadmin so checkSuperAdminPermission passes; prisma is stubbed.
const superSession = {
  user: { id: "u-super", email: "super@cmu.ac.th", role: "superadmin" },
};

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSession: (vi.fn(async () => superSession) as unknown) as typeof actual.getSession,
  };
});

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue("log-id"),
}));

const { findUnique, count, update, del } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: { adminUser: { findUnique, count, update, delete: del } },
}));

const prisma = (await import("@/lib/prisma")).default;
const { PUT, DELETE } = await import("@/app/api/users/[id]/route");

const BASE = "http://localhost/alumni";
const ID = "00000000-0000-0000-0000-000000000000";
const activeSuper = {
  id: ID,
  role: "superadmin",
  isActive: true,
  email: "s@cmu.ac.th",
  firstName: "S",
  lastName: "U",
  passwordHash: "",
};
const putReq = (body: unknown) =>
  new NextRequest(`${BASE}/api/users/${ID}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
const deleteReq = () => new NextRequest(`${BASE}/api/users/${ID}`, { method: "DELETE" });
const ctx = () => ({ params: Promise.resolve({ id: ID }) });

describe("last-superadmin guard (security #10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.adminUser.findUnique.mockResolvedValue(activeSuper);
  });

  it("PUT demote of the last active superadmin → 400", async () => {
    prisma.adminUser.count.mockResolvedValue(1);
    const res = await PUT(putReq({ role: "admin" }), ctx());
    expect(res.status).toBe(400);
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
  });

  it("PUT deactivate of the last active superadmin → 400", async () => {
    prisma.adminUser.count.mockResolvedValue(1);
    const res = await PUT(putReq({ isActive: false }), ctx());
    expect(res.status).toBe(400);
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
  });

  it("DELETE of the last active superadmin → 400", async () => {
    prisma.adminUser.count.mockResolvedValue(1);
    const res = await DELETE(deleteReq(), ctx());
    expect(res.status).toBe(400);
    expect(prisma.adminUser.delete).not.toHaveBeenCalled();
  });

  it("DELETE of a superadmin when another active superadmin exists → 200", async () => {
    prisma.adminUser.count.mockResolvedValue(2);
    prisma.adminUser.delete.mockResolvedValue(activeSuper);
    const res = await DELETE(deleteReq(), ctx());
    expect(res.status).toBe(200);
    expect(prisma.adminUser.delete).toHaveBeenCalled();
  });

  it("PUT that does NOT remove a superadmin (email change) is not blocked", async () => {
    prisma.adminUser.count.mockResolvedValue(1);
    prisma.adminUser.update.mockResolvedValue({ ...activeSuper, email: "new@cmu.ac.th" });
    const res = await PUT(putReq({ email: "new@cmu.ac.th" }), ctx());
    expect(res.status).toBe(200);
    expect(prisma.adminUser.count).not.toHaveBeenCalled();
  });
});

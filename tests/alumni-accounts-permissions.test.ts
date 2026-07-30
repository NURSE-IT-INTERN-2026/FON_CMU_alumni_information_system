// @vitest-environment node
/**
 * Regression guard for the alumni-accounts permission family (W1).
 *
 * The read-only "executive" role must NOT be able to read account-management
 * data or change/suspend alumni accounts (PRD §2.1/§4.1) — only admin/superadmin.
 * Previously the list/single GETs skipped `checkNonExecutivePermission` and the
 * PUT (change-email) + suspend POST skipped `checkWritePermission`, letting an
 * executive take over any alumni account (change login email → forgot/reset →
 * login). This locks the fix in: an executive session must get 403 on every
 * alumni-accounts handler BEFORE any database work.
 *
 * We mock `@/lib/auth`.getSession to an executive session and let the REAL
 * guards in `lib/permissions.ts` run, so this exercises the actual role check.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// An executive (read-only) staff session. The real guards read session.user.role.
const executiveSession = {
  user: { id: "u-exec", email: "exec@cmu.ac.th", role: "executive" },
};

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSession: (async () => executiveSession) as unknown as typeof actual.getSession,
  };
});

// Imported AFTER vi.mock so the handlers see the mocked session.
const { GET: getList } = await import("@/app/api/alumni-accounts/route");
const { GET: getOne, PUT: putOne } = await import(
  "@/app/api/alumni-accounts/[id]/route"
);
const { POST: suspend } = await import(
  "@/app/api/alumni-accounts/[id]/suspend/route"
);

const BASE = "http://localhost/alumni";
const ID = "00000000-0000-0000-0000-000000000000";
const req = (p: string, init?: RequestInit) => new NextRequest(`${BASE}${p}`, init);
const params = () => ({ params: Promise.resolve({ id: ID }) });

describe("alumni-accounts permission guards — executive ⇒ 403", () => {
  it("GET /api/alumni-accounts (list) is forbidden to executive", async () => {
    const res = await getList(req("/api/alumni-accounts"));
    expect(res.status).toBe(403);
  });

  it("GET /api/alumni-accounts/[id] is forbidden to executive", async () => {
    const res = await getOne(req(`/api/alumni-accounts/${ID}`), params());
    expect(res.status).toBe(403);
  });

  it("PUT /api/alumni-accounts/[id] (change email) is forbidden to executive", async () => {
    const res = await putOne(
      req(`/api/alumni-accounts/${ID}`, {
        method: "PUT",
        body: JSON.stringify({ email: "attacker@controlled.tld" }),
      }),
      params(),
    );
    expect(res.status).toBe(403);
  });

  it("POST /api/alumni-accounts/[id]/suspend is forbidden to executive", async () => {
    const res = await suspend(
      req(`/api/alumni-accounts/${ID}/suspend`, {
        method: "POST",
        body: JSON.stringify({ suspend: true }),
      }),
      params(),
    );
    expect(res.status).toBe(403);
  });
});

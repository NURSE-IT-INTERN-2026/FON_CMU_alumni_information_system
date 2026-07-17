// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * apiFetch centralizes client-side API calls. These tests lock in the
 * expired-session behavior added to stop "Failed to load alumni profile logs":
 *   - a 401 (session expired/missing) redirects to /login?expired=1 AND rejects;
 *   - a 403 (logged-in-but-forbidden) does NOT redirect — the user is still authed;
 *   - a redirect is skipped when already on /login (loop guard);
 *   - a 200 still returns the parsed body.
 * `vi.resetModules()` re-imports apiFetch per test so the module-level
 * duplicate-redirect flag resets between cases.
 */
describe("apiFetch 401 redirect", () => {
  let navigatedTo = "";

  beforeEach(() => {
    vi.resetModules();
    navigatedTo = "";
    // Replace window.location with an observable stub (capture the href setter).
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: "/management/dashboard",
        get href() {
          return navigatedTo;
        },
        set href(v: string) {
          navigatedTo = v;
        },
      },
    });
  });

  function fakeResponse(status: number, body: unknown) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 401 ? "Unauthorized" : "Forbidden",
      json: async () => body,
    };
  }

  it("redirects to /login?expired=1 and rejects on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(fakeResponse(401, { error: "กรุณาเข้าสู่ระบบ" })),
    );
    const { apiFetch } = await import("@/lib/api-client");
    await expect(apiFetch("/api/alumni/abc/activity")).rejects.toThrow();
    expect(navigatedTo).toBe("/alumni/login?expired=1");
  });

  it("does NOT redirect on 403 (forbidden) — still rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(fakeResponse(403, { error: "forbidden" })),
    );
    const { apiFetch } = await import("@/lib/api-client");
    await expect(apiFetch("/api/x")).rejects.toThrow();
    expect(navigatedTo).toBe("");
  });

  it("does not redirect when already on /login (loop guard)", async () => {
    (window.location as { pathname: string }).pathname = "/alumni/login";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(401, { error: "x" })));
    const { apiFetch } = await import("@/lib/api-client");
    await expect(apiFetch("/api/x")).rejects.toThrow();
    expect(navigatedTo).toBe("");
  });

  it("returns parsed body on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(fakeResponse(200, { items: [] })),
    );
    const { apiFetch } = await import("@/lib/api-client");
    await expect(apiFetch("/api/x")).resolves.toEqual({ items: [] });
    expect(navigatedTo).toBe("");
  });
});

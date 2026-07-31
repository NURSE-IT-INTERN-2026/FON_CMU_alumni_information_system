import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

// Regression test for security #15: an oversized upload is rejected from its
// Content-Length BEFORE the body is buffered (formData not called).
const adminSession = { user: { id: "u1", email: "a@cmu.ac.th", role: "superadmin" } };

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSession: (vi.fn(async () => adminSession) as unknown) as typeof actual.getSession,
  };
});

const { POST } = await import("@/app/api/upload/route");

const mockRequest = (contentLength: string | null) => {
  const formData = vi.fn();
  const req = {
    headers: {
      get: (n: string) => (n.toLowerCase() === "content-length" ? contentLength : null),
    },
    formData,
  } as unknown as NextRequest;
  return { req, formData };
};

describe("upload Content-Length pre-check (security #15)", () => {
  it("rejects an oversized Content-Length with 400 before buffering", async () => {
    const { req, formData } = mockRequest(String(50 * 1024 * 1024)); // 50MB > 10MB threshold
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(formData).not.toHaveBeenCalled();
  });

  it("lets a small Content-Length through to formData (not blocked by the pre-check)", async () => {
    const { req, formData } = mockRequest("1024"); // 1KB
    formData.mockResolvedValue({ get: () => null }); // no file → handler 400s "missing file"
    const res = await POST(req);
    expect(res.status).toBe(400); // missing-file 400, but formData WAS reached
    expect(formData).toHaveBeenCalled();
  });
});

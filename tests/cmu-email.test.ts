import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TOKEN = "test-access-token";

type Recorded = { url: string; body: unknown; headers: Headers };
type Canned = { body: Record<string, unknown>; status?: number };

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

const OK_TOKEN: Canned = {
  body: { success: true, access_token: TOKEN, token_type: "Bearer", expires_in: 86400 },
};
const OK_SEND: Canned = { body: { success: true, message: "Email sent successfully" } };

// Records every fetch the email module makes and returns canned responses per
// endpoint. A fresh Response is built per call (a Response body is single-use,
// so the refresh test's second GetToken needs its own). Returns the call log.
function mockFetch(opts?: { getToken?: Canned; sendEmail?: Canned }): Recorded[] {
  const getToken = opts?.getToken ?? OK_TOKEN;
  const sendEmail = opts?.sendEmail ?? OK_SEND;
  const calls: Recorded[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input as string;
    const rawBody = init?.body;
    calls.push({
      url,
      body: typeof rawBody === "string" ? JSON.parse(rawBody) : undefined,
      headers: new Headers(init?.headers),
    });
    if (url.endsWith("/EmailApi/GetToken")) {
      return jsonResponse(getToken.body, { status: getToken.status ?? 200 });
    }
    if (url.endsWith("/EmailApi/SendEmail")) {
      return jsonResponse(sendEmail.body, { status: sendEmail.status ?? 200 });
    }
    return new Response("not found", { status: 404 });
  });
  return calls;
}

beforeEach(() => {
  vi.resetModules();
  process.env.CMU_EMAIL_API_BASE_URL = "https://email.example.cmu.ac.th";
  process.env.CMU_EMAIL_CLIENT_ID = "client-id";
  process.env.CMU_EMAIL_CLIENT_SECRET = "client-secret";
  process.env.CMU_EMAIL_SYSTEM_NAME = "Test System";
  process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete process.env.EMAIL_BASE_URL;
});

describe("CMU Email API client", () => {
  it("fetches a token then sends — first send hits GetToken and SendEmail in order", async () => {
    const calls = mockFetch();
    const { sendSignupApprovedEmail } = await import("@/lib/email");
    await sendSignupApprovedEmail("a@cmu.ac.th", "คุณ สมชาย");

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toMatch(/\/EmailApi\/GetToken$/);
    expect(calls[0].body).toEqual({
      client_id: "client-id",
      client_secret: "client-secret",
    });

    expect(calls[1].url).toMatch(/\/EmailApi\/SendEmail$/);
    expect(calls[1].headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);

    const sendBody = calls[1].body as Record<string, string>;
    expect(sendBody.sent_to).toBe("a@cmu.ac.th");
    expect(sendBody.system_name).toBe("Test System");
    expect(sendBody.subject).toContain("อนุมัติแล้ว");
    expect(sendBody.message).toContain("เรียน คุณ สมชาย,");
    expect(sendBody.message).toContain("http://localhost:3000/alumni/login");
  });

  it("reuses the cached token — a second send skips GetToken", async () => {
    const calls = mockFetch();
    const mod = await import("@/lib/email");
    await mod.sendSignupApprovedEmail("a@cmu.ac.th", "A");
    calls.length = 0;
    await mod.sendSignupApprovedEmail("b@cmu.ac.th", "B");

    // Only SendEmail this time — the token from the first call is still valid.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/EmailApi\/SendEmail$/);
    expect((calls[0].body as Record<string, string>).sent_to).toBe("b@cmu.ac.th");
  });

  it("refreshes the token once it is within the 1h pre-expiry window", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-01-01T00:00:00Z");
    vi.setSystemTime(start);

    const calls = mockFetch();
    const mod = await import("@/lib/email");
    await mod.sendSignupApprovedEmail("a@cmu.ac.th", "A"); // caches a 24h token
    calls.length = 0;

    // 23h30m later — past the 23h refresh threshold, so GetToken runs again.
    vi.setSystemTime(new Date("2026-01-01T23:30:00Z"));
    await mod.sendSignupApprovedEmail("b@cmu.ac.th", "B");

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toMatch(/\/EmailApi\/GetToken$/);
    expect(calls[1].url).toMatch(/\/EmailApi\/SendEmail$/);
  });

  it("rejects when GetToken fails (success:false / 401)", async () => {
    mockFetch({
      getToken: {
        body: { success: false, message: "Invalid client_id or client_secret" },
        status: 401,
      },
    });
    const { sendSignupApprovedEmail } = await import("@/lib/email");
    await expect(sendSignupApprovedEmail("a@cmu.ac.th", "A")).rejects.toThrow(
      /GetToken failed/,
    );
  });

  it("rejects when SendEmail fails (success:false / 500)", async () => {
    mockFetch({
      sendEmail: { body: { success: false, message: "SMTP error" }, status: 500 },
    });
    const { sendSignupApprovedEmail } = await import("@/lib/email");
    await expect(sendSignupApprovedEmail("a@cmu.ac.th", "A")).rejects.toThrow(
      /SendEmail failed/,
    );
  });

  it("rejects without calling the API when credentials are not configured", async () => {
    delete process.env.CMU_EMAIL_API_BASE_URL;
    const spy = vi.spyOn(globalThis, "fetch");
    const { sendSignupApprovedEmail } = await import("@/lib/email");
    await expect(sendSignupApprovedEmail("a@cmu.ac.th", "A")).rejects.toThrow(
      /not configured/,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("includes the optional reason in the rejected-signup body when present", async () => {
    const calls = mockFetch();
    const { sendSignupRejectedEmail } = await import("@/lib/email");
    await sendSignupRejectedEmail("a@cmu.ac.th", "คุณ สมหญิง", "เอกสารไม่ครบ");

    const sendBody = calls.at(-1).body as Record<string, string>;
    expect(sendBody.message).toContain("เหตุผลที่ปฏิเสธ: เอกสารไม่ครบ");
    expect(sendBody.message).toContain(
      "http://localhost:3000/alumni/graduates/reapply?email=a%40cmu.ac.th",
    );
  });

  it("prefers EMAIL_BASE_URL over NEXT_PUBLIC_BASE_URL for email links", async () => {
    process.env.EMAIL_BASE_URL = "https://alumni.nurse.cmu.ac.th";
    const calls = mockFetch();
    const { sendSignupApprovedEmail } = await import("@/lib/email");
    await sendSignupApprovedEmail("a@cmu.ac.th", "คุณ สมชาย");
    const sendBody = calls.at(-1).body as Record<string, string>;
    expect(sendBody.message).toContain(
      "https://alumni.nurse.cmu.ac.th/alumni/login",
    );
    expect(sendBody.message).not.toContain("localhost");
  });

  it("validateEmailBaseUrl: dev allows localhost, prod rejects it, prod accepts a real URL", async () => {
    const { validateEmailBaseUrl } = await import("@/lib/email");
    // dev/test env (NODE_ENV !== "production"): localhost is fine
    expect(validateEmailBaseUrl().ok).toBe(true);

    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      // localhost → not ok
      const bad = validateEmailBaseUrl();
      expect(bad.ok).toBe(false);
      if (!bad.ok) expect(bad.reason).toMatch(/EMAIL_BASE_URL/);

      // real URL → ok
      process.env.EMAIL_BASE_URL = "https://alumni.nurse.cmu.ac.th";
      expect(validateEmailBaseUrl().ok).toBe(true);

      // trailing slash is trimmed
      process.env.EMAIL_BASE_URL = "https://alumni.nurse.cmu.ac.th/";
      const trimmed = validateEmailBaseUrl();
      expect(trimmed.ok).toBe(true);
      if (trimmed.ok) expect(trimmed.url).toBe("https://alumni.nurse.cmu.ac.th");
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("in production with a localhost base URL, sendEmail throws before calling fetch", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    // no EMAIL_BASE_URL → falls back to NEXT_PUBLIC_BASE_URL=localhost
    try {
      const spy = vi.spyOn(globalThis, "fetch");
      const { sendSignupApprovedEmail } = await import("@/lib/email");
      await expect(sendSignupApprovedEmail("a@cmu.ac.th", "A")).rejects.toThrow(
        /Refusing to send email/,
      );
      expect(spy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

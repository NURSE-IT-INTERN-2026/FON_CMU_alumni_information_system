import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { exchangeCodeForToken } from "@/lib/oauth";

// Regression test for security #5: the CMU OAuth token-endpoint response body
// (which can contain access_token / refresh_token / id_token or echoed request
// detail) must never reach production logs or the thrown error message.
const ORIG_NODE_ENV = process.env.NODE_ENV;

describe("exchangeCodeForToken — token-body redaction (security #5)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
    process.env.NODE_ENV = ORIG_NODE_ENV;
  });

  const loggedText = () =>
    (errorSpy.mock.calls as unknown[][])
      .flat()
      .map((v) => String(v))
      .join(" ");

  it("prod: failed-exchange body never reaches logs or the thrown error (status still logged)", async () => {
    process.env.NODE_ENV = "production";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () =>
          '{"error":"invalid_grant","error_description":"BADCODE"}',
      })),
    );

    const err = await exchangeCodeForToken("c", "v").catch((e: Error) => e);
    const combined = `${(err as Error).message} ${loggedText()}`;

    expect(combined).not.toContain("BADCODE");
    expect(combined).not.toContain("error_description");
    expect(loggedText()).toContain("400"); // status is still surfaced
  });

  it("prod: missing-access_token response body never reaches logs or the thrown error", async () => {
    process.env.NODE_ENV = "production";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ refresh_token: "SUPERSECRET" }),
      })),
    );

    const err = await exchangeCodeForToken("c", "v").catch((e: Error) => e);
    const combined = `${(err as Error).message} ${loggedText()}`;

    expect(combined).not.toContain("SUPERSECRET");
    expect(loggedText()).toContain("access_token"); // fixed message still logged
  });

  it("dev: the body IS logged (dev gate works)", async () => {
    process.env.NODE_ENV = "development";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => "DEVBODY-DEBUG",
      })),
    );

    await exchangeCodeForToken("c", "v").catch(() => {});
    expect(loggedText()).toContain("DEVBODY-DEBUG");
  });
});

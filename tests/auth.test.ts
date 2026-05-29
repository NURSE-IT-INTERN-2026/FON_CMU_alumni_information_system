import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie } from "@/lib/auth";

describe("hashPassword / verifyPassword", () => {
  it("hashes a password and verifies it correctly", async () => {
    const password = "MySecurePassword!123";
    const hashed = await hashPassword(password);
    expect(hashed).not.toBe(password);
    expect(hashed.startsWith("$2")).toBe(true); // bcrypt prefix
    await expect(verifyPassword(password, hashed)).resolves.toBe(true);
  });

  it("returns false for a wrong password", async () => {
    const hashed = await hashPassword("correct-password");
    await expect(verifyPassword("wrong-password", hashed)).resolves.toBe(false);
  });

  it("produces different hashes for the same password (bcrypt salting)", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
    // Both should still verify
    await expect(verifyPassword("same", h1)).resolves.toBe(true);
    await expect(verifyPassword("same", h2)).resolves.toBe(true);
  });
});

describe("setSessionCookie", () => {
  it("returns a cookie descriptor with the correct shape", () => {
    const cookie = setSessionCookie("test-token-123");
    expect(cookie.name).toBe("fon-cmu-session");
    expect(cookie.value).toBe("test-token-123");
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/");
    expect(typeof cookie.maxAge).toBe("number");
    expect(cookie.maxAge).toBeGreaterThan(0);
  });

  it("sets secure=false outside production", () => {
    // In vitest, NODE_ENV is 'test', so secure should be false
    const cookie = setSessionCookie("token");
    expect(cookie.secure).toBe(false);
  });
});

describe("clearSessionCookie", () => {
  it("returns a cookie descriptor that expires the session", () => {
    const cookie = clearSessionCookie();
    expect(cookie.name).toBe("fon-cmu-session");
    expect(cookie.value).toBe("");
    expect(cookie.maxAge).toBe(0);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe("/");
  });
});

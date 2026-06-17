/**
 * Playwright auth helpers for the per-page TanStack Query verification scripts.
 *
 * Login is performed through the context's own APIRequest so the session cookie
 * (`fon-cmu-session`) lands in the BrowserContext's cookie jar; pages opened from
 * that same context are then authenticated. Same cookie name for admin and
 * alumni sessions — only the login endpoint and session type differ server-side.
 */
import { chromium, type Browser, type Page } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export interface AuthedSession {
  browser: Browser;
  page: Page;
}

async function newAuthedPage(
  loginPath: string,
  creds: { email: string; password: string },
  role: "admin" | "alumni",
): Promise<AuthedSession> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: BASE });
  const res = await ctx.request.post(loginPath, { data: creds });
  if (!res.ok()) {
    const body = await res.text().catch(() => "");
    await browser.close();
    throw new Error(`${role} login failed (${res.status()}): ${body}`);
  }
  const page = await ctx.newPage();
  return { browser, page };
}

/** Seed superadmin (see prisma/seed.ts). Override via env for other accounts. */
export function adminSession(
  creds: { email: string; password: string } = {
    email: process.env.ADMIN_EMAIL ?? "superadmin@cmu.ac.th",
    password: process.env.ADMIN_PASSWORD ?? "password123",
  },
) {
  return newAuthedPage("/alumni/api/auth/login", creds, "admin");
}

export function alumniSession(creds: { email: string; password: string }) {
  return newAuthedPage(
    "/alumni/api/alumni-auth/login-email",
    creds,
    "alumni",
  );
}

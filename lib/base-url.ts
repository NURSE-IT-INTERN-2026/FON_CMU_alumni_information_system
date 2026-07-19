// Server-only resolution + production fail-safe for the app's public base URL —
// the origin used to build absolute URLs for EXTERNAL consumers (email links,
// OAuth callback redirect, logout redirects). Internal routing (basePath
// "/alumni", next/link, relative fetches) is unaffected.
//
// Why a dedicated var: NEXT_PUBLIC_* is statically inlined by Next.js at
// `next build` time, and the Docker image builds WITHOUT NEXT_PUBLIC_BASE_URL
// set (.dockerignore excludes .env), so the deployed server bakes
// "http://localhost:3000" regardless of any runtime env. PUBLIC_BASE_URL is a
// plain server var (non-NEXT_PUBLIC_) → NOT inlined → read fresh from the
// container env at runtime, so a deploy can target a new domain WITHOUT
// rebuilding.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Resolves the public base URL at RUNTIME: PUBLIC_BASE_URL (server-only,
 * non-inlined) → NEXT_PUBLIC_BASE_URL (build-time-inlined; dev) → localhost.
 * Trims trailing slash(es).
 */
export function getBaseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export type BaseUrlCheck =
  | { ok: true; url: string }
  | { ok: false; url: string; reason: string };

/**
 * Production fail-safe. Returns ok:false when the resolved base URL is missing
 * or a loopback host (localhost / 127.0.0.1 / ::1) under NODE_ENV="production".
 * Used three ways:
 *   - lib/email.ts sendEmail() throws on !ok (best-effort callers log +
 *     suppress → no broken link is ever mailed);
 *   - instrumentation.ts register() logs a loud boot warning on !ok;
 *   - the auth redirect routes just call getBaseUrl() (no throw) — a localhost
 *     redirect is self-evidently broken and the boot warning is the signal.
 * Dev (NODE_ENV !== "production") always passes.
 */
export function validateBaseUrl(): BaseUrlCheck {
  const url = getBaseUrl();
  if (process.env.NODE_ENV === "production") {
    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      host = "";
    }
    if (!host || LOCAL_HOSTS.has(host)) {
      return {
        ok: false,
        url,
        reason: `public base URL resolves to "${url}" (missing or localhost) in production — set the server-only PUBLIC_BASE_URL to the public URL (e.g. https://alumni.nurse.cmu.ac.th). NEXT_PUBLIC_BASE_URL is build-time-inlined and will NOT override this at runtime.`,
      };
    }
  }
  return { ok: true, url };
}

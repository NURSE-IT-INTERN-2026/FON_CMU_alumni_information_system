// Next.js startup hook — runs once when a new server instance starts, before it
// handles requests (see node_modules/next/dist/docs/.../instrumentation.md).
//
// Public base-URL fail-safe: in production, warn loudly at boot if
// PUBLIC_BASE_URL is missing or still localhost, so a misconfigured deploy is
// caught early. NON-crashing by design — the hard guarantee is the send-time
// guard in lib/email.ts (a bad base URL throws before any email is mailed, and
// best-effort callers log + suppress it). The auth redirect routes use
// getBaseUrl() WITHOUT throwing (a localhost redirect is self-evidently broken;
// this boot warning is their signal). Node.js runtime only.
import { validateBaseUrl } from "@/lib/base-url";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  const check = validateBaseUrl();
  if (!check.ok) {
    console.error("⚠️ PUBLIC BASE URL FAIL-SAFE: " + check.reason);
  }
}

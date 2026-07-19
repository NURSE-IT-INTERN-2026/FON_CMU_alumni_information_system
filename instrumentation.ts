// Next.js startup hook — runs once when a new server instance starts, before it
// handles requests (see node_modules/next/dist/docs/.../instrumentation.md).
//
// Used here for the email base-URL fail-safe: in production, warn loudly at boot
// if EMAIL_BASE_URL is missing or still localhost, so a misconfigured deploy is
// caught early. NON-crashing by design — the hard guarantee is the send-time
// guard in lib/email.ts (a bad base URL throws before any email is mailed, and
// the best-effort callers log + suppress it). Node.js runtime only.
import { validateEmailBaseUrl } from "@/lib/email";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  const check = validateEmailBaseUrl();
  if (!check.ok) {
    console.error("⚠️ EMAIL FAIL-SAFE: " + check.reason);
  }
}

/**
 * Resolve the client IP for rate-limiting, TRUSTING a single reverse proxy.
 *
 * Prefers `X-Real-IP` (nginx `proxy_set_header X-Real-IP $remote_addr`
 * overwrites any client-sent value), then the RIGHTMOST `X-Forwarded-For`
 * entry (nginx `$proxy_add_x_forwarded_for` appends the real client IP last).
 *
 * The previous code read the LEFTMOST XFF entry, which a client can freely set
 * to rotate the rate-limit key and evade the per-IP cap. REQUIRES the trusted
 * proxy to set these headers — without it they are client-controlled and the
 * rate limit is bypassable. Accepts any `Headers`-like object (works for both
 * `await headers()` and `request.headers`).
 */
export function getClientIp(headers: {
  get(name: string): string | null;
}): string {
  const realIp = headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // Rightmost non-empty entry = the one our trusted proxy appended.
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "unknown";
}

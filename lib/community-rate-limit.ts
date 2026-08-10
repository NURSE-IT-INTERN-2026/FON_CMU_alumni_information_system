import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";

// Per-IP spam caps for alumni community UGC (the in-memory limiter in
// lib/rate-limit.ts — single-instance / standalone output). Buckets are
// per-action so e.g. posting a lot doesn't burn the report budget.
export const COMMUNITY_POST_LIMIT = 30; // topics/replies/feed posts/comments/events
export const COMMUNITY_REPORT_LIMIT = 10; // content reports
export const COMMUNITY_UPLOAD_LIMIT = 20; // alumni image uploads

/**
 * Returns a 429 response if the per-IP bucket is exhausted, else null. Call
 * AFTER the auth gate (so anonymous/unauthorized requests are rejected first
 * and don't consume the limit). The IP comes from `getClientIp`, which trusts
 * the reverse proxy's X-Real-IP / rightmost XFF.
 */
export function communityRateLimit(
  request: NextRequest,
  bucket: "post" | "report" | "upload",
  max: number,
): NextResponse | null {
  const ip = getClientIp(request.headers);
  const rl = checkRateLimit(`community-${bucket}:${ip}`, max);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "ดำเนินการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }
  return null;
}

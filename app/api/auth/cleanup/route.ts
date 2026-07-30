import { NextResponse } from "next/server";
import { cleanupExpiredSessions } from "@/lib/auth";

// Prune expired sessions. Secured by the CLEANUP_SECRET env var (bearer token).
// Accepts GET or DELETE so a cron job may use either method.
//   curl https://<host>/api/auth/cleanup -H "Authorization: Bearer <CLEANUP_SECRET>"
//   curl -X DELETE https://<host>/api/auth/cleanup -H "Authorization: Bearer <CLEANUP_SECRET>"
async function runCleanup(request: Request) {
  const secret = process.env.CLEANUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLEANUP_SECRET not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await cleanupExpiredSessions();
  return NextResponse.json({ deleted });
}

export async function GET(request: Request) {
  return runCleanup(request);
}

export async function DELETE(request: Request) {
  return runCleanup(request);
}

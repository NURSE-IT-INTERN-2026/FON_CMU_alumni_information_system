import { NextResponse } from "next/server";
import { cleanupExpiredSessions } from "@/lib/auth";

// DELETE /api/auth/cleanup
// Prune expired sessions. Secured by CLEANUP_SECRET env var.
// Call this from a cron job or scheduled task:
//   curl -X DELETE https://<host>/api/auth/cleanup \
//        -H "Authorization: Bearer <CLEANUP_SECRET>"
export async function DELETE(request: Request) {
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

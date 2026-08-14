import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cleanupExpiredSessions, constantTimeEqual } from "@/lib/auth";

// Prune expired sessions + old read notifications. Secured by the
// CLEANUP_SECRET env var (bearer token). Accepts GET or DELETE so a cron job
// may use either method.
//   curl https://<host>/api/auth/cleanup -H "Authorization: Bearer <CLEANUP_SECRET>"
//   curl -X DELETE https://<host>/api/auth/cleanup -H "Authorization: Bearer <CLEANUP_SECRET>"
const NOTIFICATION_RETENTION_DAYS = 90;

async function runCleanup(request: Request) {
  const secret = process.env.CLEANUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLEANUP_SECRET not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (!constantTimeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await cleanupExpiredSessions();
  // Purge READ notifications older than the retention window (community V2).
  // Deliberately NOT logged (housekeeping, like the logs bulk-delete).
  const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const notifications = await prisma.notification.deleteMany({
    where: { readAt: { not: null }, createdAt: { lt: cutoff } },
  });
  return NextResponse.json({ deleted, notificationsPurged: notifications.count });
}

export async function GET(request: Request) {
  return runCleanup(request);
}

export async function DELETE(request: Request) {
  return runCleanup(request);
}

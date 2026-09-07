import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import type { LogAction, LogResource } from "@/lib/log-types";

// The unions live in client-safe `lib/log-types.ts` so `lib/log-detail.ts` can
// type its Thai label maps against them; re-exported here for existing callers.
export type { LogAction, LogResource };

interface AdminLogContext {
  actorType: "ADMIN";
  userId: string;
  userEmail: string;
  userRole: string;
}

interface AlumniLogContext {
  actorType: "ALUMNI";
  alumniId: string;
  alumniName: string;
}

interface SystemLogContext {
  actorType: "SYSTEM";
}

export type LogContext = AdminLogContext | AlumniLogContext | SystemLogContext;

export async function logActivity(
  ctx: LogContext,
  action: LogAction,
  resource: LogResource,
  resourceId?: string | null,
  details?: Record<string, unknown> | null,
  reason?: string | null,
  tx: Prisma.TransactionClient = prisma
): Promise<string | null> {
  try {
    const common = {
      action,
      resource,
      resourceId: resourceId ?? null,
      reason: reason ?? null,
      details: details ? (details as Prisma.InputJsonValue) : undefined,
    };
    let data: Prisma.ActivityLogUncheckedCreateInput;
    if (ctx.actorType === "ADMIN") {
      data = {
        ...common,
        actorType: "ADMIN",
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        userRole: ctx.userRole,
      };
    } else if (ctx.actorType === "ALUMNI") {
      data = {
        ...common,
        actorType: "ALUMNI",
        alumniId: ctx.alumniId,
        alumniName: ctx.alumniName,
      };
    } else {
      // SYSTEM: an automated actor (e.g. the CMU_SYNC_SECRET cron). The
      // identity columns stay null (they're nullable); only actorType is set.
      data = {
        ...common,
        actorType: "SYSTEM",
      };
    }
    const log = await tx.activityLog.create({ data });
    return log.id;
  } catch (err) {
    // Logging must never break the main request
    console.error("Failed to write activity log:", err);
    return null;
  }
}

import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export type LogAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "IMPORT"
  | "EXPORT"
  | "BULK_DELETE"
  | "SIGNUP"
  | "LOGIN"
  | "EMAIL_VERIFY_REQUEST"
  | "EMAIL_VERIFY"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET_COMPLETE"
  | "APPROVE"
  | "REJECT"
  | "REAPPLY"
  | "VERIFY_IDENTITY"
  | "RESTORE"
  | "SUSPEND"
  | "HARD_DELETE"
  | "LINK"
  // Alumni community forum
  | "OPT_IN"
  | "OPT_OUT"
  | "REPORT"
  | "RESOLVE"
  | "DISMISS";

export type LogResource =
  | "alumni"
  | "award"
  | "association"
  | "graduate_committee"
  | "potential"
  | "model_representative"
  | "alumni_agency"
  | "news"
  | "user"
  | "alumni_profile"
  | "alumni_auth"
  | "cmu_alumni"
  | "education"
  // Alumni community forum
  | "forum_topic"
  | "forum_reply"
  | "community"
  | "content_report"
  // Alumni community events
  | "community_event"
  | "event_rsvp"
  // Alumni activity feed
  | "feed_post"
  | "feed_comment";

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

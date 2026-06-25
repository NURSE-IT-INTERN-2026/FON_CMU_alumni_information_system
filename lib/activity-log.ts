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
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET_COMPLETE"
  | "APPROVE"
  | "REJECT"
  | "VERIFY_IDENTITY"
  | "RESTORE"
  | "SUSPEND"
  | "HARD_DELETE";

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
  | "education";

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

// System-generated events (e.g. graduation logs). alumniId/alumniName optional
// — set when the event is about a specific alumni.
interface SystemLogContext {
  actorType: "SYSTEM";
  alumniId?: string;
  alumniName?: string;
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
      data = {
        ...common,
        actorType: "SYSTEM",
        ...(ctx.alumniId ? { alumniId: ctx.alumniId } : {}),
        ...(ctx.alumniName ? { alumniName: ctx.alumniName } : {}),
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

export function getIp(request: Request): string | null {
  const forwarded = (request as { headers: Headers }).headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

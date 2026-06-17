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
  | "cmu_alumni";

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

export type LogContext = AdminLogContext | AlumniLogContext;

export async function logActivity(
  ctx: LogContext,
  action: LogAction,
  resource: LogResource,
  resourceId?: string | null,
  details?: Record<string, unknown> | null,
  ipAddress?: string | null,
  reason?: string | null
): Promise<void> {
  try {
    if (ctx.actorType === "ADMIN") {
      await prisma.activityLog.create({
        data: {
          actorType: "ADMIN",
          userId: ctx.userId,
          userEmail: ctx.userEmail,
          userRole: ctx.userRole,
          action,
          resource,
          resourceId: resourceId ?? null,
          reason: reason ?? null,
          details: details ? (details as Prisma.InputJsonValue) : undefined,
          ipAddress: ipAddress ?? null,
        },
      });
    } else {
      await prisma.activityLog.create({
        data: {
          actorType: "ALUMNI",
          alumniId: ctx.alumniId,
          alumniName: ctx.alumniName,
          action,
          resource,
          resourceId: resourceId ?? null,
          reason: reason ?? null,
          details: details ? (details as Prisma.InputJsonValue) : undefined,
          ipAddress: ipAddress ?? null,
        },
      });
    }
  } catch (err) {
    // Logging must never break the main request
    console.error("Failed to write activity log:", err);
  }
}

export function getIp(request: Request): string | null {
  const forwarded = (request as { headers: Headers }).headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export type LogAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "IMPORT"
  | "EXPORT"
  | "BULK_DELETE";

export type LogResource =
  | "alumni"
  | "award"
  | "association"
  | "graduate_committee"
  | "potential"
  | "model_representative"
  | "abroad_alumni"
  | "news"
  | "user";

interface LogContext {
  userId: string;
  userEmail: string;
  userRole: string;
}

export async function logActivity(
  ctx: LogContext,
  action: LogAction,
  resource: LogResource,
  resourceId?: string | null,
  details?: Record<string, unknown> | null,
  ipAddress?: string | null
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        userRole: ctx.userRole,
        action,
        resource,
        resourceId: resourceId ?? null,
        details: (details ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: ipAddress ?? null,
      },
    });
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

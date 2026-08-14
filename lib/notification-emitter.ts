import prisma from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  notificationLink,
  notificationText,
  type NotificationTypeValue,
} from "@/lib/notification-text";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

/**
 * Server-only, best-effort notification emitters (community V2). A failed
 * notification insert must NEVER fail the parent action — every emit is
 * wrapped and only console.error'd.
 *
 * O(1) per actor-directed event. The ONE fan-out case (a new topic in a
 * group) is capped at GROUP_NOTIFY_CAP members and delivered as ONE chunked
 * createMany. Staff announcements do NOT emit at all (watermark instead).
 */

type Db = typeof prisma | Prisma.TransactionClient;

export const GROUP_NOTIFY_CAP = 200;
const CREATE_MANY_CHUNK = 500;

interface EmitInput {
  alumniId: string;
  type: NotificationTypeValue;
  entityId?: string | null;
  actor?: AlumniPublicIdentity | { prefix: string; firstName: string; lastName: string } | null;
  topicTitle?: string | null;
  postSnippet?: string | null;
  eventTitle?: string | null;
  groupTitle?: string | null;
  outcome?: "RESOLVED" | "DISMISSED" | null;
  /** Self-actions are skipped (you don't notify yourself). */
  skipAlumniId?: string | null;
}

/** Emit one notification (no-op when the target IS the actor). Best-effort. */
export async function emitNotification(input: EmitInput, db: Db = prisma): Promise<void> {
  if (input.skipAlumniId && input.alumniId === input.skipAlumniId) return;
  try {
    const { title, body } = notificationText(input.type, input);
    await db.notification.create({
      data: {
        alumniId: input.alumniId,
        type: input.type,
        entityId: input.entityId ?? null,
        title,
        body,
        link: notificationLink(input.type, input.entityId),
      },
    });
  } catch (error) {
    console.error("emitNotification failed (suppressed):", error);
  }
}

/**
 * Fan-out to a group's members (except the actor) — ONLY when the group is
 * at/below GROUP_NOTIFY_CAP members; larger groups are skipped (documented
 * cap: a 5,000-member cohort group would otherwise generate 5,000 rows per
 * topic). One chunked createMany; best-effort.
 */
export async function emitToGroupMembers(
  input: Omit<EmitInput, "alumniId"> & {
    groupId: string;
    /** Pre-fetched member ids (caller owns the query). */
    memberIds: string[];
  },
  db: Db = prisma,
): Promise<void> {
  try {
    const memberIds = input.memberIds;
    if (memberIds.length === 0 || memberIds.length > GROUP_NOTIFY_CAP) return;
    const targets = input.skipAlumniId
      ? memberIds.filter((id) => id !== input.skipAlumniId)
      : memberIds;
    if (targets.length === 0) return;

    const { title, body } = notificationText(input.type, input);
    const data = targets.map((alumniId) => ({
      alumniId,
      type: input.type,
      entityId: input.entityId ?? null,
      title,
      body,
      link: notificationLink(input.type, input.entityId),
    }));

    for (let i = 0; i < data.length; i += CREATE_MANY_CHUNK) {
      await db.notification.createMany({ data: data.slice(i, i + CREATE_MANY_CHUNK) });
    }
  } catch (error) {
    console.error("emitToGroupMembers failed (suppressed):", error);
  }
}

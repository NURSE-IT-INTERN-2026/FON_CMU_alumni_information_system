import prisma from "@/lib/prisma";
import type { LogResource } from "@/lib/activity-log";

export interface TrashEntityConfig {
  /** Prisma client delegate key. */
  delegate: string;
  /** Thai display label for the entity. */
  label: string;
  /** Fields used to build a human-readable record name. */
  nameFields: string[];
  /** Activity-log resource string. */
  resource: LogResource;
}

/** Entities that support soft-delete + restore/hard-delete (PRD §3.11). */
export const TRASH_ENTITIES: Record<string, TrashEntityConfig> = {
  alumni: { delegate: "alumni", label: "ข้อมูลนักศึกษาเก่า", nameFields: ["prefix", "firstName", "lastName"], resource: "alumni" },
  awards: { delegate: "award", label: "รางวัล", nameFields: ["awardName"], resource: "award" },
  associations: { delegate: "association", label: "สมาคม/ชมรม", nameFields: ["associationName"], resource: "association" },
  "graduate-committee": { delegate: "graduateCommittee", label: "กรรมการบัณฑิต", nameFields: ["prefix", "firstName", "lastName"], resource: "graduate_committee" },
  "model-representatives": { delegate: "modelRepresentative", label: "ผู้แทนรุ่น", nameFields: ["prefix", "firstName", "lastName"], resource: "model_representative" },
  potentials: { delegate: "potential", label: "ศักยภาพ", nameFields: ["prefix", "firstName", "lastName"], resource: "potential" },
  "alumni-agency": { delegate: "alumniAgency", label: "ข้อมูลการทำงานศิษย์เก่า", nameFields: ["prefix", "firstName", "lastName", "englishName", "country"], resource: "alumni_agency" },
  // Alumni community forum — admin moderation soft-deletes are recoverable here
  // (superadmin). ContentReport is NOT here (its lifecycle is a status, not soft-delete).
  "forum-topic": { delegate: "forumTopic", label: "กระทู้", nameFields: ["title"], resource: "forum_topic" },
  "forum-reply": { delegate: "forumReply", label: "ความคิดเห็น", nameFields: ["body"], resource: "forum_reply" },
  // Alumni community events — RSVPs cascade on event delete (not separately listed).
  "community-event": { delegate: "communityEvent", label: "กิจกรรม", nameFields: ["title"], resource: "community_event" },
  // Alumni activity feed — likes/comments cascade on post delete.
  "feed-post": { delegate: "feedPost", label: "โพสต์", nameFields: ["body"], resource: "feed_post" },
  "feed-comment": { delegate: "feedComment", label: "ความคิดเห็น", nameFields: ["body"], resource: "feed_comment" },
  // Community V2 groups — memberships cascade on group delete (topics/events
  // survive: their groupId is SetNull and they fall back to the forum-wide list).
  "community-group": { delegate: "communityGroup", label: "กลุ่มศิษย์เก่า", nameFields: ["title"], resource: "community_group" },
};

export const TRASH_PAGE_SIZE = 10;

/** Build a display name from a record using the entity's name fields. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDisplayName(record: any, nameFields: string[]): string {
  return nameFields
    .map((f) => record?.[f])
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
    .join(" ")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDelegate(entity: string): any {
  const cfg = TRASH_ENTITIES[entity];
  if (!cfg) throw new Error("Unknown entity");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[cfg.delegate];
}

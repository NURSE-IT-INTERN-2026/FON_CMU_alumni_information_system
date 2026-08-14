/**
 * Thai title/body/link builders per NotificationType (community V2).
 * Client-safe (pure) — the emitter snapshots these into the row at create
 * time, and the UI renders the stored strings as-is.
 */
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

export type NotificationTypeValue =
  | "REPLY_TO_MY_TOPIC"
  | "LIKE_ON_MY_POST"
  | "COMMENT_ON_MY_POST"
  | "RSVP_ON_MY_EVENT"
  | "NEW_GROUP_TOPIC"
  | "MENTORSHIP_REQUEST"
  | "MENTORSHIP_RESPONSE"
  | "REPORT_OUTCOME";

function nameOf(a: AlumniPublicIdentity | { prefix: string; firstName: string; lastName: string }): string {
  return `${a.prefix}${a.firstName} ${a.lastName}`.trim();
}

export function notificationLink(type: NotificationTypeValue, entityId?: string | null): string | null {
  switch (type) {
    case "REPLY_TO_MY_TOPIC":
    case "NEW_GROUP_TOPIC":
      return entityId ? `/graduates/forum/${entityId}` : "/graduates/forum";
    case "LIKE_ON_MY_POST":
    case "COMMENT_ON_MY_POST":
      return entityId ? `/graduates/feed/${entityId}` : "/graduates/feed";
    case "RSVP_ON_MY_EVENT":
      return entityId ? `/graduates/events/${entityId}` : "/graduates/events";
    case "MENTORSHIP_REQUEST":
    case "MENTORSHIP_RESPONSE":
      return "/graduates/mentorship";
    case "REPORT_OUTCOME":
      return null; // No dedicated page — the title/body says it all.
  }
}

/** Build the pre-rendered title/body for a notification. */
export function notificationText(
  type: NotificationTypeValue,
  input: {
    actor?: AlumniPublicIdentity | { prefix: string; firstName: string; lastName: string } | null;
    topicTitle?: string | null;
    postSnippet?: string | null;
    eventTitle?: string | null;
    groupTitle?: string | null;
    outcome?: "RESOLVED" | "DISMISSED" | null;
  } = {},
): { title: string; body: string | null } {
  const actor = input.actor ? nameOf(input.actor) : null;
  switch (type) {
    case "REPLY_TO_MY_TOPIC":
      return {
        title: actor ? `${actor} ตอบกระทู้ของคุณ` : "กระทู้ของคุณมีความคิดเห็นใหม่",
        body: input.topicTitle ?? null,
      };
    case "LIKE_ON_MY_POST":
      return { title: actor ? `${actor} ถูกใจโพสต์ของคุณ` : "โพสต์ของคุณถูกใจ", body: null };
    case "COMMENT_ON_MY_POST":
      return {
        title: actor ? `${actor} แสดงความคิดเห็นบนโพสต์ของคุณ` : "โพสต์ของคุณมีความคิดเห็นใหม่",
        body: input.postSnippet ?? null,
      };
    case "RSVP_ON_MY_EVENT":
      return {
        title: actor ? `${actor} ลงทะเบียนเข้าร่วมกิจกรรมของคุณ` : "กิจกรรมของคุณมีผู้ลงทะเบียนใหม่",
        body: input.eventTitle ?? null,
      };
    case "NEW_GROUP_TOPIC":
      return {
        title: actor ? `${actor} เริ่มการสนทนาใหม่ใน${input.groupTitle ?? "กลุ่ม"}` : "มีการสนทนาใหม่ในกลุ่มของคุณ",
        body: input.topicTitle ?? null,
      };
    case "MENTORSHIP_REQUEST":
      return { title: actor ? `${actor} ส่งคำขอขอคำปรึกษาถึงคุณ` : "มีคำขอขอคำปรึกษาใหม่", body: null };
    case "MENTORSHIP_RESPONSE":
      return {
        title: actor ? `${actor} ตอบกลับคำขอขอคำปรึกษาของคุณ` : "คำขอขอคำปรึกษาของคุณได้รับการตอบกลับ",
        body: null,
      };
    case "REPORT_OUTCOME":
      return {
        title: input.outcome === "DISMISSED" ? "รายงานของคุณถูกยกเลิก" : "รายงานของคุณได้รับการดำเนินการแล้ว",
        body: null,
      };
  }
}

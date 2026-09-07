/**
 * Activity-log type unions — client-safe (no Prisma import).
 *
 * `lib/activity-log.ts` (the writer) pulls in Prisma, so these unions live here
 * where the client-safe reader (`lib/log-detail.ts`) can import them to type its
 * Thai label maps as `Record<LogAction, string>` / `Record<LogResource, string>`
 * — making label completeness a compile-time guarantee. Re-exported from
 * `lib/activity-log.ts` so existing importers are unaffected.
 */

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
  | "feed_comment"
  // Alumni community V2
  | "community_profile"
  | "community_group"
  | "group_membership"
  | "job_posting"
  | "event_photo"
  | "announcement";

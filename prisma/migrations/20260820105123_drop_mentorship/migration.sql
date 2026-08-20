-- DropTables
DROP TABLE "mentorship_requests";
DROP TABLE "mentor_profiles";

-- DropEnum
DROP TYPE "MentorshipStatus";

-- AlterEnum
-- MENTORSHIP_REQUEST / MENTORSHIP_RESPONSE removed from "NotificationType".
-- Postgres cannot drop enum values in place, so the type is recreated and the
-- column re-cast. Rows carrying the removed labels are deleted FIRST (their
-- links point at /graduates/mentorship, which this migration removes) —
-- otherwise the cast below would fail on any surviving row.
DELETE FROM "notifications" WHERE "type" IN ('MENTORSHIP_REQUEST', 'MENTORSHIP_RESPONSE');

-- CreateEnum
CREATE TYPE "NotificationType_new" AS ENUM ('REPLY_TO_MY_TOPIC', 'LIKE_ON_MY_POST', 'COMMENT_ON_MY_POST', 'RSVP_ON_MY_EVENT', 'NEW_GROUP_TOPIC', 'REPORT_OUTCOME');

-- AlterEnum
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");

-- DropEnum
DROP TYPE "NotificationType";

-- RenameEnum
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REPLY_TO_MY_TOPIC', 'LIKE_ON_MY_POST', 'COMMENT_ON_MY_POST', 'RSVP_ON_MY_EVENT', 'NEW_GROUP_TOPIC', 'MENTORSHIP_REQUEST', 'MENTORSHIP_RESPONSE', 'REPORT_OUTCOME');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_alumniId_readAt_createdAt_idx" ON "notifications"("alumniId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_alumniId_createdAt_idx" ON "notifications"("alumniId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

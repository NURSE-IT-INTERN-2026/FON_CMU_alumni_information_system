-- CreateEnum
CREATE TYPE "ContentReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ContentReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ForumReportResource" AS ENUM ('FORUM_TOPIC', 'FORUM_REPLY');

-- AlterTable
ALTER TABLE "alumni" ADD COLUMN     "communityOptedInAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "forum_topics" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastReplyAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_replies" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "resourceType" "ForumReportResource" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "reason" "ContentReportReason" NOT NULL,
    "reasonDetail" TEXT,
    "status" "ContentReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forum_topics_authorId_idx" ON "forum_topics"("authorId");

-- CreateIndex
CREATE INDEX "forum_topics_deletedAt_createdAt_idx" ON "forum_topics"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "forum_topics_lastReplyAt_idx" ON "forum_topics"("lastReplyAt");

-- CreateIndex
CREATE INDEX "forum_replies_topicId_createdAt_idx" ON "forum_replies"("topicId", "createdAt");

-- CreateIndex
CREATE INDEX "forum_replies_authorId_idx" ON "forum_replies"("authorId");

-- CreateIndex
CREATE INDEX "forum_replies_deletedAt_idx" ON "forum_replies"("deletedAt");

-- CreateIndex
CREATE INDEX "content_reports_status_createdAt_idx" ON "content_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "content_reports_resourceType_resourceId_idx" ON "content_reports"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "content_reports_reporterId_idx" ON "content_reports"("reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_reporterId_resourceType_resourceId_key" ON "content_reports"("reporterId", "resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "forum_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

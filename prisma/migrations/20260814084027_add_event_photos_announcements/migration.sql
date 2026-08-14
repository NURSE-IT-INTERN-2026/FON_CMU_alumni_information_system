-- AlterEnum
ALTER TYPE "ForumReportResource" ADD VALUE 'EVENT_PHOTO';

-- AlterTable
ALTER TABLE "alumni" ADD COLUMN     "announcementsLastReadAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "event_photos" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploaderAlumniId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_photos_eventId_createdAt_idx" ON "event_photos"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "announcements_deletedAt_createdAt_idx" ON "announcements"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "announcements_expiresAt_idx" ON "announcements"("expiresAt");

-- AddForeignKey
ALTER TABLE "event_photos" ADD CONSTRAINT "event_photos_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "community_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_photos" ADD CONSTRAINT "event_photos_uploaderAlumniId_fkey" FOREIGN KEY ("uploaderAlumniId") REFERENCES "alumni"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

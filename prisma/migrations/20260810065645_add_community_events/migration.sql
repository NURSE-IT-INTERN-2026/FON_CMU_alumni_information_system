-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('ATTENDING', 'DECLINED');

-- AlterEnum
ALTER TYPE "ForumReportResource" ADD VALUE 'EVENT';

-- CreateTable
CREATE TABLE "community_events" (
    "id" TEXT NOT NULL,
    "organizerAlumniId" TEXT,
    "organizerUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "onlineLink" TEXT,
    "coverImageUrl" TEXT,
    "capacity" INTEGER,
    "guestLimit" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL,
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_events_startAt_idx" ON "community_events"("startAt");

-- CreateIndex
CREATE INDEX "community_events_deletedAt_startAt_idx" ON "community_events"("deletedAt", "startAt");

-- CreateIndex
CREATE INDEX "event_rsvps_eventId_status_idx" ON "event_rsvps"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_rsvps_eventId_alumniId_key" ON "event_rsvps"("eventId", "alumniId");

-- AddForeignKey
ALTER TABLE "community_events" ADD CONSTRAINT "community_events_organizerAlumniId_fkey" FOREIGN KEY ("organizerAlumniId") REFERENCES "alumni"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_events" ADD CONSTRAINT "community_events_organizerUserId_fkey" FOREIGN KEY ("organizerUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "community_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

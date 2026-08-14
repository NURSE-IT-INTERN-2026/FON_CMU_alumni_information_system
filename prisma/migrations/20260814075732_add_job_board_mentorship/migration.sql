-- CreateEnum
CREATE TYPE "MentorshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ForumReportResource" ADD VALUE 'JOB_POSTING';

-- CreateTable
CREATE TABLE "job_postings" (
    "id" TEXT NOT NULL,
    "authorAlumniId" TEXT,
    "authorUserId" TEXT,
    "title" TEXT NOT NULL,
    "workplace" TEXT NOT NULL,
    "position" TEXT,
    "province" TEXT,
    "country" TEXT,
    "description" TEXT NOT NULL,
    "applyUrl" TEXT,
    "contactInfo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_profiles" (
    "id" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "expertise" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "accepting" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_requests" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "MentorshipStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentorship_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_postings_expiresAt_idx" ON "job_postings"("expiresAt");

-- CreateIndex
CREATE INDEX "job_postings_deletedAt_createdAt_idx" ON "job_postings"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "job_postings_province_idx" ON "job_postings"("province");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_profiles_alumniId_key" ON "mentor_profiles"("alumniId");

-- CreateIndex
CREATE INDEX "mentorship_requests_mentorId_status_idx" ON "mentorship_requests"("mentorId", "status");

-- CreateIndex
CREATE INDEX "mentorship_requests_menteeId_status_idx" ON "mentorship_requests"("menteeId", "status");

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_authorAlumniId_fkey" FOREIGN KEY ("authorAlumniId") REFERENCES "alumni"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

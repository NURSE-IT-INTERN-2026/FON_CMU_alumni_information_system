/*
  Warnings:

  - A unique constraint covering the columns `[citizenId]` on the table `alumni` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('ADMIN', 'ALUMNI');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'ALUMNI');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "DegreeLevel" ADD VALUE 'ASSOCIATE';

-- AlterEnum
ALTER TYPE "NewsStatus" ADD VALUE 'DISCONTINUED';

-- AlterTable
ALTER TABLE "abroad_alumni" ADD COLUMN     "homeAddress" TEXT;

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "actorType" "ActorType" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN     "alumniId" TEXT,
ADD COLUMN     "alumniName" TEXT,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "userEmail" DROP NOT NULL,
ALTER COLUMN "userRole" DROP NOT NULL;

-- AlterTable
ALTER TABLE "alumni" ADD COLUMN     "adminEditedAt" TIMESTAMP(3),
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "birthDate" TEXT,
ADD COLUMN     "citizenId" TEXT,
ADD COLUMN     "cmuEmail" TEXT,
ADD COLUMN     "hasLoggedIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "alumniId" TEXT,
ADD COLUMN     "sessionType" "SessionType" NOT NULL DEFAULT 'ADMIN',
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX "password_resets_alumniId_idx" ON "password_resets"("alumniId");

-- CreateIndex
CREATE INDEX "password_resets_expiresAt_idx" ON "password_resets"("expiresAt");

-- CreateIndex
CREATE INDEX "activity_logs_alumniId_idx" ON "activity_logs"("alumniId");

-- CreateIndex
CREATE INDEX "activity_logs_actorType_idx" ON "activity_logs"("actorType");

-- CreateIndex
CREATE INDEX "alumni_approvalStatus_idx" ON "alumni"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "alumni_citizenId_key" ON "alumni"("citizenId");

-- CreateIndex
CREATE INDEX "sessions_alumniId_idx" ON "sessions"("alumniId");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "alumni"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

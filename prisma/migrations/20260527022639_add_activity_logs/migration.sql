/*
  Warnings:

  - You are about to drop the column `address` on the `abroad_alumni` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `abroad_alumni` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `abroad_alumni` table. All the data in the column will be lost.
  - You are about to drop the column `university` on the `abroad_alumni` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "abroad_alumni" DROP CONSTRAINT IF EXISTS "abroad_alumni_studentId_fkey";

-- DropConstraint
ALTER TABLE "abroad_alumni" DROP CONSTRAINT IF EXISTS "abroad_alumni_studentId_order_key";

-- AlterTable
ALTER TABLE "abroad_alumni" DROP COLUMN "address",
DROP COLUMN "name",
DROP COLUMN "studentId",
DROP COLUMN "university",
ADD COLUMN     "cohort" TEXT,
ADD COLUMN     "englishName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "prefix" TEXT,
ADD COLUMN     "thaiName" TEXT,
ADD COLUMN     "workplace" TEXT;

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_resource_idx" ON "activity_logs"("resource");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

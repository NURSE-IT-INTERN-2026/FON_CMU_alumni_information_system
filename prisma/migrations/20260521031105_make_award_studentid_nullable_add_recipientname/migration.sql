-- Drop unique constraint
ALTER TABLE "awards" DROP CONSTRAINT IF EXISTS "awards_studentId_awardName_year_key";

-- AlterTable
ALTER TABLE "awards" ADD COLUMN     "recipientName" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL;

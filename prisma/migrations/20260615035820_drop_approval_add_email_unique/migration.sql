-- DropIndex
DROP INDEX "alumni_approvalStatus_idx";

-- AlterTable
ALTER TABLE "alumni" DROP COLUMN "approvalStatus",
DROP COLUMN "approvedAt";

-- DropEnum
DROP TYPE "ApprovalStatus";

-- CreateIndex
CREATE UNIQUE INDEX "alumni_email_key" ON "alumni"("email");

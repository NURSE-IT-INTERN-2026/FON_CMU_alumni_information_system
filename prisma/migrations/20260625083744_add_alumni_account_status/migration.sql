-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- AlterTable
ALTER TABLE "alumni" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "signupVerification" JSONB;

-- CreateIndex
CREATE INDEX "alumni_accountStatus_idx" ON "alumni"("accountStatus");

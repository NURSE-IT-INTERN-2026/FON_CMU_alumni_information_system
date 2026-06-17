-- AlterTable
ALTER TABLE "abroad_alumni" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "major" TEXT;

-- AlterTable
ALTER TABLE "alumni" ADD COLUMN     "graduationYear" INTEGER,
ADD COLUMN     "homeAddress" TEXT,
ADD COLUMN     "major" TEXT,
ADD COLUMN     "remarks" TEXT;

-- AlterTable
ALTER TABLE "associations" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "major" TEXT;

-- AlterTable
ALTER TABLE "awards" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "major" TEXT;

-- AlterTable
ALTER TABLE "graduate_committees" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "major" TEXT;

-- AlterTable
ALTER TABLE "model_representatives" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "major" TEXT;

-- AlterTable
ALTER TABLE "potentials" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "major" TEXT;

-- CreateIndex
CREATE INDEX "abroad_alumni_major_idx" ON "abroad_alumni"("major");

-- CreateIndex
CREATE INDEX "alumni_major_idx" ON "alumni"("major");

-- CreateIndex
CREATE INDEX "alumni_graduationYear_idx" ON "alumni"("graduationYear");

-- CreateIndex
CREATE INDEX "associations_major_idx" ON "associations"("major");

-- CreateIndex
CREATE INDEX "awards_major_idx" ON "awards"("major");

-- CreateIndex
CREATE INDEX "graduate_committees_major_idx" ON "graduate_committees"("major");

-- CreateIndex
CREATE INDEX "model_representatives_major_idx" ON "model_representatives"("major");

-- CreateIndex
CREATE INDEX "potentials_major_idx" ON "potentials"("major");

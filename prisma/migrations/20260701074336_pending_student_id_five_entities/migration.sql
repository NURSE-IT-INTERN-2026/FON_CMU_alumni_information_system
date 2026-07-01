-- AlterTable
ALTER TABLE "associations" ADD COLUMN     "pendingStudentId" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "awards" ADD COLUMN     "pendingStudentId" TEXT;

-- AlterTable
ALTER TABLE "graduate_committees" ADD COLUMN     "pendingStudentId" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "model_representatives" ADD COLUMN     "pendingStudentId" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "potentials" ADD COLUMN     "pendingStudentId" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "associations_pendingStudentId_idx" ON "associations"("pendingStudentId");

-- CreateIndex
CREATE INDEX "awards_pendingStudentId_idx" ON "awards"("pendingStudentId");

-- CreateIndex
CREATE INDEX "graduate_committees_pendingStudentId_idx" ON "graduate_committees"("pendingStudentId");

-- CreateIndex
CREATE INDEX "model_representatives_pendingStudentId_idx" ON "model_representatives"("pendingStudentId");

-- CreateIndex
CREATE INDEX "potentials_pendingStudentId_idx" ON "potentials"("pendingStudentId");

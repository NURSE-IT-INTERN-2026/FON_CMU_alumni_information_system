-- AlterTable
ALTER TABLE "alumni_agency" ADD COLUMN     "pendingStudentId" TEXT;

-- CreateIndex
CREATE INDEX "alumni_agency_pendingStudentId_idx" ON "alumni_agency"("pendingStudentId");

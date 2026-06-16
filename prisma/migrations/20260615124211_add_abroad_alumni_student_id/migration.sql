-- AlterTable
ALTER TABLE "abroad_alumni" ADD COLUMN     "studentId" TEXT;

-- CreateIndex
CREATE INDEX "abroad_alumni_studentId_idx" ON "abroad_alumni"("studentId");

-- AddForeignKey
ALTER TABLE "abroad_alumni" ADD CONSTRAINT "abroad_alumni_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "alumni"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;

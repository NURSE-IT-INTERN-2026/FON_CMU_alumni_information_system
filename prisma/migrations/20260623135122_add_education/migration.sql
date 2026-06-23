-- AlterTable
ALTER TABLE "alumni" ADD COLUMN     "primaryEducationId" TEXT;

-- CreateTable
CREATE TABLE "education" (
    "id" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "degreeLevel" "DegreeLevel" NOT NULL,
    "graduationYear" INTEGER,
    "major" TEXT,
    "cohort" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "education_studentId_key" ON "education"("studentId");

-- CreateIndex
CREATE INDEX "education_alumniId_idx" ON "education"("alumniId");

-- CreateIndex
CREATE UNIQUE INDEX "education_alumniId_degreeLevel_key" ON "education"("alumniId", "degreeLevel");

-- CreateIndex
CREATE UNIQUE INDEX "alumni_primaryEducationId_key" ON "alumni"("primaryEducationId");

-- AddForeignKey
ALTER TABLE "alumni" ADD CONSTRAINT "alumni_primaryEducationId_fkey" FOREIGN KEY ("primaryEducationId") REFERENCES "education"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education" ADD CONSTRAINT "education_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

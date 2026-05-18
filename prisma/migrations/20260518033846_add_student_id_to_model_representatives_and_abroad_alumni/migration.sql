-- AlterTable
ALTER TABLE "abroad_alumni" ADD COLUMN "studentId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "model_representatives" ADD COLUMN "studentId" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "generation" DROP DEFAULT;

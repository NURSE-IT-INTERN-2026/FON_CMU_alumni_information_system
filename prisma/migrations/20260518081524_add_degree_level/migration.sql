-- CreateEnum
CREATE TYPE "DegreeLevel" AS ENUM ('DOCTORAL', 'MASTER', 'BACHELOR', 'NURSING_ASSISTANT');

-- AlterTable
ALTER TABLE "abroad_alumni" ALTER COLUMN "studentId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "alumni" ADD COLUMN     "degreeLevel" "DegreeLevel",
ALTER COLUMN "prefix" DROP DEFAULT,
ALTER COLUMN "maidenLastName" DROP DEFAULT;

-- AlterTable
ALTER TABLE "model_representatives" ALTER COLUMN "studentId" DROP DEFAULT;

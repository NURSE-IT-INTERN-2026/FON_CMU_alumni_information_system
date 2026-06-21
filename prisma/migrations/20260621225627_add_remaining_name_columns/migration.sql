-- AlterTable
ALTER TABLE "alumni_agency" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- AlterTable
ALTER TABLE "associations" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "prefix" TEXT,
ALTER COLUMN "fullName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "graduate_committees" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "prefix" TEXT,
ALTER COLUMN "fullName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "model_representatives" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "prefix" TEXT,
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "alumni_agency" DROP COLUMN "thaiName";

-- AlterTable
ALTER TABLE "associations" DROP COLUMN "fullName",
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;

-- AlterTable
ALTER TABLE "graduate_committees" DROP COLUMN "fullName",
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;

-- AlterTable
ALTER TABLE "model_representatives" DROP COLUMN "name",
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;

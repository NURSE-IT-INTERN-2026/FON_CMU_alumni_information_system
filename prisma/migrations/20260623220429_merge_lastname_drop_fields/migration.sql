-- AlterTable
ALTER TABLE "alumni" DROP COLUMN "country",
DROP COLUMN "currentWorkplace",
DROP COLUMN "maidenLastName",
DROP COLUMN "newLastName",
DROP COLUMN "province",
ALTER COLUMN "lastName" SET NOT NULL;

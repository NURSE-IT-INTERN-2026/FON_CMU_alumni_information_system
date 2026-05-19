/*
  Warnings:

  - Made the column `degreeLevel` on table `alumni` required. This step will fail if there are existing NULL values in that column.

*/

UPDATE "alumni" SET "degreeLevel" = 'BACHELOR' WHERE "degreeLevel" IS NULL;
-- AlterTable
ALTER TABLE "alumni" ALTER COLUMN "degreeLevel" SET NOT NULL;

-- RenameIndex
ALTER INDEX "associations_studentId_associationName_position_recordedYear_ke" RENAME TO "associations_studentId_associationName_position_recordedYea_key";

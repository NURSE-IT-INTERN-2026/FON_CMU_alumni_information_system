/*
  Warnings:

  - You are about to drop the column `alumniId` on the `graduate_committees` table. All the data in the column will be lost.
  - You are about to drop the column `degreeLevel` on the `graduate_committees` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `graduate_committees` table. All the data in the column will be lost.
  - Added the required column `cohort` to the `graduate_committees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `graduate_committees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position` to the `graduate_committees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentId` to the `graduate_committees` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "graduate_committees" DROP CONSTRAINT "graduate_committees_alumniId_fkey";

-- AlterTable
ALTER TABLE "graduate_committees" DROP COLUMN "alumniId",
DROP COLUMN "degreeLevel",
DROP COLUMN "role",
ADD COLUMN     "cohort" TEXT NOT NULL,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "position" TEXT NOT NULL,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "studentId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "model_representatives" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cohort" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_representatives_pkey" PRIMARY KEY ("id")
);

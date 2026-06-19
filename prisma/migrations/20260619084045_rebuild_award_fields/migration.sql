/*
  Warnings:

  - You are about to drop the column `recipientName` on the `awards` table. All the data in the column will be lost.
  - Added the required column `firstName` to the `awards` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `awards` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "awards" DROP COLUMN "recipientName",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "prefix" TEXT;

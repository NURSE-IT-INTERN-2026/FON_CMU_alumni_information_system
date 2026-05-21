/*
  Warnings:

  - You are about to drop the column `name` on the `admin_users` table. All the data in the column will be lost.
  - Added the required column `firstName` to the `admin_users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `admin_users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "admin_users" DROP COLUMN "name",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ALTER COLUMN "passwordHash" SET DEFAULT '';

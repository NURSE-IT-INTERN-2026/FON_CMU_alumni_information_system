/*
  Warnings:

  - You are about to drop the `table_column_widths` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "table_column_widths" DROP CONSTRAINT "table_column_widths_userId_fkey";

-- DropTable
DROP TABLE "table_column_widths";

-- AlterTable
ALTER TABLE "model_representatives" DROP COLUMN "order";
ALTER TABLE "model_representatives" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1;

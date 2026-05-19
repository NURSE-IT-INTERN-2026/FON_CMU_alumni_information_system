-- AlterTable
ALTER TABLE "abroad_alumni" ADD CONSTRAINT "abroad_alumni_studentId_order_key" UNIQUE ("studentId", "order");

-- AlterTable
ALTER TABLE "associations" ADD CONSTRAINT "associations_studentId_associationName_position_recordedYear_key" UNIQUE ("studentId", "associationName", "position", "recordedYear");

-- AlterTable
ALTER TABLE "awards" ADD CONSTRAINT "awards_studentId_awardName_year_key" UNIQUE ("studentId", "awardName", "year");

-- AlterTable
ALTER TABLE "graduate_committees" ADD CONSTRAINT "graduate_committees_studentId_termYear_position_key" UNIQUE ("studentId", "termYear", "position");

-- AlterTable
ALTER TABLE "model_representatives" ADD CONSTRAINT "model_representatives_studentId_cohort_generation_key" UNIQUE ("studentId", "cohort", "generation");

-- AlterTable
ALTER TABLE "news" ADD CONSTRAINT "news_title_key" UNIQUE ("title");

-- AlterTable
ALTER TABLE "potentials" ADD CONSTRAINT "potentials_studentId_recordedYear_key" UNIQUE ("studentId", "recordedYear");

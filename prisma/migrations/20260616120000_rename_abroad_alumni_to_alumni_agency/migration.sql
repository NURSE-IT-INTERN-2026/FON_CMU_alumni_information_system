-- Rename the `abroad_alumni` table (and its dependent objects) to `alumni_agency`.
-- Pure rename: no columns or data change. Keeps index/constraint names aligned with
-- what Prisma expects for the renamed model so no schema drift is introduced.

ALTER TABLE "abroad_alumni" RENAME TO "alumni_agency";

ALTER TABLE "alumni_agency" RENAME CONSTRAINT "abroad_alumni_pkey" TO "alumni_agency_pkey";
ALTER TABLE "alumni_agency" RENAME CONSTRAINT "abroad_alumni_studentId_fkey" TO "alumni_agency_studentId_fkey";

ALTER INDEX "abroad_alumni_studentId_idx" RENAME TO "alumni_agency_studentId_idx";
ALTER INDEX "abroad_alumni_major_idx" RENAME TO "alumni_agency_major_idx";

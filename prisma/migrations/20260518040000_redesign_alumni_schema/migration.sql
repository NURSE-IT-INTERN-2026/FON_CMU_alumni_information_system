-- Migration: redesign_alumni_schema
-- This migration handles the case where steps 1-4 may already be applied
-- due to a partial migration failure.

-- Step 1: Add new columns to alumni (IF NOT EXISTS for safety)
DO $$ BEGIN
  ALTER TABLE "alumni" ADD COLUMN "prefix" TEXT NOT NULL DEFAULT 'นางสาว';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "alumni" ADD COLUMN "maidenLastName" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "alumni" ADD COLUMN "cohort" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "alumni" ADD COLUMN "newLastName" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "alumni" ADD COLUMN "province" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Step 2: Migrate existing data (only if lastName still exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alumni' AND column_name = 'lastName') THEN
    UPDATE "alumni" SET "maidenLastName" = "lastName" WHERE "maidenLastName" = '' AND "lastName" IS NOT NULL;
  END IF;
END $$;

-- Step 3: Drop old columns from alumni (IF EXISTS for safety)
ALTER TABLE "alumni" DROP COLUMN IF EXISTS "lastName";
ALTER TABLE "alumni" DROP COLUMN IF EXISTS "degreeLevel";
ALTER TABLE "alumni" DROP COLUMN IF EXISTS "initialYear";
ALTER TABLE "alumni" DROP COLUMN IF EXISTS "graduationYear";
ALTER TABLE "alumni" DROP COLUMN IF EXISTS "expertise";
ALTER TABLE "alumni" DROP COLUMN IF EXISTS "achievementSummary";

-- Step 4: Migrate awards from alumniId to studentId
DO $$ BEGIN
  ALTER TABLE "awards" ADD COLUMN "studentId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'awards' AND column_name = 'alumniId') THEN
    UPDATE "awards" SET "studentId" = (SELECT "studentId" FROM "alumni" WHERE "alumni"."id" = "awards"."alumniId") WHERE "studentId" IS NULL;
    DELETE FROM "awards" WHERE "studentId" IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE "awards" ALTER COLUMN "studentId" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE "awards" DROP COLUMN IF EXISTS "alumniId";

-- Step 5: Delete orphan linked records with empty/null studentId, then create placeholder alumni
DELETE FROM "associations" WHERE "studentId" IS NULL OR "studentId" = '';
DELETE FROM "graduate_committees" WHERE "studentId" IS NULL OR "studentId" = '';
DELETE FROM "potentials" WHERE "studentId" IS NULL OR "studentId" = '';
DELETE FROM "model_representatives" WHERE "studentId" IS NULL OR "studentId" = '';
DELETE FROM "abroad_alumni" WHERE "studentId" IS NULL OR "studentId" = '';

-- For associations
INSERT INTO "alumni" ("id", "studentId", "prefix", "firstName", "maidenLastName", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  a."studentId",
  'นางสาว',
  COALESCE(split_part(a."fullName", ' ', 1), 'ไม่ทราบ'),
  COALESCE(split_part(a."fullName", ' ', 2), 'ไม่ทราบ'),
  NOW(),
  NOW()
FROM (SELECT DISTINCT "studentId", "fullName" FROM "associations" WHERE "studentId" IS NOT NULL AND "studentId" != '') a
WHERE NOT EXISTS (SELECT 1 FROM "alumni" al WHERE al."studentId" = a."studentId");

-- For graduate_committees
INSERT INTO "alumni" ("id", "studentId", "prefix", "firstName", "maidenLastName", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  gc."studentId",
  'นางสาว',
  COALESCE(split_part(gc."fullName", ' ', 1), 'ไม่ทราบ'),
  COALESCE(split_part(gc."fullName", ' ', 2), 'ไม่ทราบ'),
  NOW(),
  NOW()
FROM (SELECT DISTINCT "studentId", "fullName" FROM "graduate_committees" WHERE "studentId" IS NOT NULL AND "studentId" != '') gc
WHERE NOT EXISTS (SELECT 1 FROM "alumni" al WHERE al."studentId" = gc."studentId");

-- For potentials
INSERT INTO "alumni" ("id", "studentId", "prefix", "firstName", "maidenLastName", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  p."studentId",
  'นางสาว',
  COALESCE(split_part(p."fullName", ' ', 1), 'ไม่ทราบ'),
  COALESCE(split_part(p."fullName", ' ', 2), 'ไม่ทราบ'),
  NOW(),
  NOW()
FROM (SELECT DISTINCT "studentId", "fullName" FROM "potentials" WHERE "studentId" IS NOT NULL AND "studentId" != '') p
WHERE NOT EXISTS (SELECT 1 FROM "alumni" al WHERE al."studentId" = p."studentId");

-- For model_representatives
INSERT INTO "alumni" ("id", "studentId", "prefix", "firstName", "maidenLastName", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  mr."studentId",
  'นางสาว',
  COALESCE(split_part(mr."name", ' ', 1), 'ไม่ทราบ'),
  COALESCE(split_part(mr."name", ' ', 2), 'ไม่ทราบ'),
  NOW(),
  NOW()
FROM (SELECT DISTINCT "studentId", "name" FROM "model_representatives" WHERE "studentId" IS NOT NULL AND "studentId" != '') mr
WHERE NOT EXISTS (SELECT 1 FROM "alumni" al WHERE al."studentId" = mr."studentId");

-- For abroad_alumni
INSERT INTO "alumni" ("id", "studentId", "prefix", "firstName", "maidenLastName", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  aa."studentId",
  'นางสาว',
  COALESCE(split_part(aa."name", ' ', 1), 'ไม่ทราบ'),
  COALESCE(split_part(aa."name", ' ', 2), 'ไม่ทราบ'),
  NOW(),
  NOW()
FROM (SELECT DISTINCT "studentId", "name" FROM "abroad_alumni" WHERE "studentId" IS NOT NULL AND "studentId" != '') aa
WHERE NOT EXISTS (SELECT 1 FROM "alumni" al WHERE al."studentId" = aa."studentId");

-- Step 6: Add FK constraints on all linked tables (IF NOT EXISTS via DO block)
DO $$ BEGIN
  ALTER TABLE "awards" ADD CONSTRAINT "awards_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "alumni"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "associations" ADD CONSTRAINT "associations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "alumni"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "graduate_committees" ADD CONSTRAINT "graduate_committees_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "alumni"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "potentials" ADD CONSTRAINT "potentials_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "alumni"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "model_representatives" ADD CONSTRAINT "model_representatives_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "alumni"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "abroad_alumni" ADD CONSTRAINT "abroad_alumni_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "alumni"("studentId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 7: Drop the DegreeLevel enum
DROP TYPE IF EXISTS "DegreeLevel";

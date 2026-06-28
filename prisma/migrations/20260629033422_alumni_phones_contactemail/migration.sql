-- AlterTable: replace the single `phone` text column with a `phones` text[]
-- list (multiple numbers, never a comma-clumped string) and add a contact
-- email distinct from the auth/login `email`.
ALTER TABLE "alumni" ADD COLUMN "contactEmail" TEXT;

ALTER TABLE "alumni" ADD COLUMN "phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Preserve any existing single phone number into the new array before dropping.
UPDATE "alumni" SET "phones" = ARRAY["phone"] WHERE "phone" IS NOT NULL;

ALTER TABLE "alumni" DROP COLUMN "phone";

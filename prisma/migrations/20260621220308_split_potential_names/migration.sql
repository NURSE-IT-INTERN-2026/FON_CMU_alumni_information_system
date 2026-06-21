-- Split Potential.fullName into prefix / firstName / lastName (mirrors the
-- awards refactor). Existing rows are backfilled from fullName so no data is
-- lost: a leading Thai title token (นาย/นาง/นางสาว/ดร./น.ส./พ.ญ./อ./ผศ./รศ./ศ./ม.ร.ว.)
-- is moved to prefix; the remaining tokens populate firstName + lastName.

ALTER TABLE "potentials" ADD COLUMN "prefix" TEXT;
ALTER TABLE "potentials" ADD COLUMN "firstName" TEXT;
ALTER TABLE "potentials" ADD COLUMN "lastName" TEXT;

UPDATE "potentials"
SET "prefix" = sub.prefix,
    "firstName" = sub.first_name,
    "lastName" = sub.last_name
FROM (
  SELECT
    id,
    CASE WHEN elems[1] = ANY (ARRAY['นาย','นาง','นางสาว','ดร.','น.ส.','พ.ญ.','อ.','ผศ.','รศ.','ศ.','ม.ร.ว.']) THEN elems[1] ELSE NULL END AS prefix,
    CASE WHEN elems[1] = ANY (ARRAY['นาย','นาง','นางสาว','ดร.','น.ส.','พ.ญ.','อ.','ผศ.','รศ.','ศ.','ม.ร.ว.']) THEN COALESCE(elems[2], '') ELSE COALESCE(elems[1], '') END AS first_name,
    CASE WHEN elems[1] = ANY (ARRAY['นาย','นาง','นางสาว','ดร.','น.ส.','พ.ญ.','อ.','ผศ.','รศ.','ศ.','ม.ร.ว.']) THEN COALESCE(array_to_string(elems[3:array_length(elems, 1)], ' '), '') ELSE COALESCE(array_to_string(elems[2:array_length(elems, 1)], ' '), '') END AS last_name
  FROM (
    SELECT id, string_to_array(btrim("fullName"), ' ') AS elems FROM "potentials"
  ) src
) sub
WHERE "potentials".id = sub.id;

-- Every row now has a non-null firstName/lastName, so NOT NULL is safe.
ALTER TABLE "potentials" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "potentials" ALTER COLUMN "lastName" SET NOT NULL;

ALTER TABLE "potentials" DROP COLUMN "fullName";

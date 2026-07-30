// @vitest-environment node
/**
 * Regression guard for the trash bin name columns (W3).
 *
 * `lib/trash.ts` TRASH_ENTITIES.nameFields drives both the search WHERE clause
 * (`where.OR = nameFields.map(f => ({ [f]: { contains: ... } }))`) and the
 * display name. It previously named columns removed when the person-name
 * entities were split into prefix/firstName/lastName (`fullName`/`name`/
 * `thaiName`), which made `GET /api/trash?search=...` throw a Prisma validation
 * error (HTTP 500) and rendered names blank for 4 of 7 entity types.
 *
 * This asserts every nameField is a current schema column.
 */
import { describe, expect, it } from "vitest";
import { TRASH_ENTITIES } from "@/lib/trash";

// Columns that no longer exist after the person-name split.
const REMOVED = new Set([
  "fullName",
  "name",
  "thaiName",
  "recipientName",
  "maidenLastName",
  "newLastName",
]);

describe("trash nameFields reference current schema columns (W3)", () => {
  it("no entity names a removed column", () => {
    for (const [entity, cfg] of Object.entries(TRASH_ENTITIES)) {
      for (const f of cfg.nameFields) {
        expect(REMOVED, `${entity} references removed column "${f}"`).not.toContain(f);
      }
    }
  });

  it("the split-name entities use prefix/firstName/lastName", () => {
    expect(TRASH_ENTITIES["graduate-committee"].nameFields).toEqual([
      "prefix",
      "firstName",
      "lastName",
    ]);
    expect(TRASH_ENTITIES["model-representatives"].nameFields).toEqual([
      "prefix",
      "firstName",
      "lastName",
    ]);
    expect(TRASH_ENTITIES.potentials.nameFields).toEqual([
      "prefix",
      "firstName",
      "lastName",
    ]);
    expect(TRASH_ENTITIES["alumni-agency"].nameFields).toEqual([
      "prefix",
      "firstName",
      "lastName",
      "englishName",
      "country",
    ]);
  });
});

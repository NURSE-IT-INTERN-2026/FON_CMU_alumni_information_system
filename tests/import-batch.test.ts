import { describe, expect, it } from "vitest";
import {
  chunk,
  nameIdentityKey,
  existingIdentityKey,
  incomingIdentityKeys,
  buildExistingKeyMap,
  partitionImport,
  linkResultFromMap,
  type Identity,
} from "@/lib/import-batch";

const id = (studentId: string | null, pendingStudentId: string | null, firstName: string | null, lastName: string | null): Identity => ({
  studentId,
  pendingStudentId,
  firstName,
  lastName,
});

describe("chunk", () => {
  it("splits into fixed-size slices", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns one slice when size >= length", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });
  it("returns the whole array wrapped when size <= 0", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });
  it("returns an empty array of chunks for empty input", () => {
    expect(chunk([], 5)).toEqual([]);
  });
});

describe("identity key builders", () => {
  it("existingIdentityKey prefers studentId, then pending, then name", () => {
    expect(existingIdentityKey(id("111", null, "f", "l"))).toBe("id:111");
    expect(existingIdentityKey(id(null, "222", "f", "l"))).toBe("pid:222");
    expect(existingIdentityKey(id(null, null, "f", "l"))).toBe("name:f|l");
  });

  it("nameIdentityKey uses firstName|lastName", () => {
    expect(nameIdentityKey(id(null, null, "สมชาย", "ใจดี"))).toBe("name:สมชาย|ใจดี");
  });

  it("incomingIdentityKeys adds the name candidate for id'd rows (name-fallback)", () => {
    expect(incomingIdentityKeys(id("111", null, "f", "l"))).toEqual(["id:111", "name:f|l"]);
  });

  it("incomingIdentityKeys adds the name candidate for pending rows", () => {
    expect(incomingIdentityKeys(id(null, "222", "f", "l"))).toEqual(["pid:222", "name:f|l"]);
  });

  it("incomingIdentityKeys is name-only for id-less rows", () => {
    expect(incomingIdentityKeys(id(null, null, "f", "l"))).toEqual(["name:f|l"]);
  });

  it("incomingIdentityKeys still includes the name candidate when no name is present (matches id-less+nameless existing rows)", () => {
    expect(incomingIdentityKeys(id("111", null, "", ""))).toEqual(["id:111", "name:|"]);
  });

  it("incomingIdentityKeys is name-only for an id-less + nameless row (englishName-only agency row)", () => {
    expect(incomingIdentityKeys(id(null, null, null, null))).toEqual(["name:|"]);
  });
});

describe("buildExistingKeyMap", () => {
  it("registers each existing row under its composite key", () => {
    const rows = [
      { rid: "e1", k: "id:111|Award A|2568" },
      { rid: "e2", k: "pid:222|Award B|2568" },
      { rid: "e3", k: "name:f|l|Award C|2568" },
    ];
    const map = buildExistingKeyMap(rows, (r) => r.k, (r) => r.rid);
    expect(map.get("id:111|Award A|2568")).toBe("e1");
    expect(map.get("pid:222|Award B|2568")).toBe("e2");
    expect(map.get("name:f|l|Award C|2568")).toBe("e3");
    expect(map.size).toBe(3);
  });
});

// Helper: a row with identity + a natural key (awardName|year), and the derived
// composite key builders the route would supply.
type AwardRow = {
  studentId: string | null;
  pendingStudentId: string | null;
  firstName: string;
  lastName: string;
  awardName: string;
  year: number;
};
const identityOf = (r: AwardRow): Identity => ({
  studentId: r.studentId,
  pendingStudentId: r.pendingStudentId,
  firstName: r.firstName,
  lastName: r.lastName,
});
const naturalKey = (r: AwardRow) => `${r.awardName}|${r.year}`;
const compositeFor = (identity: Identity, r: AwardRow) => `${existingIdentityKey(identity)}|${naturalKey(r)}`;
const candidatesFor = (r: AwardRow) => incomingIdentityKeys(identityOf(r)).map((k) => `${k}|${naturalKey(r)}`);
const primaryFor = (r: AwardRow) => `${candidatesFor(r)[0]}`;

describe("partitionImport", () => {
  it("sends new rows to create and matched rows to update", () => {
    const rows = [
      { studentId: "111", pendingStudentId: null, firstName: "f", lastName: "l", awardName: "A", year: 2568 },
      { studentId: "222", pendingStudentId: null, firstName: "g", lastName: "h", awardName: "B", year: 2568 },
    ];
    const existing = buildExistingKeyMap(
      [{ rid: "e1", k: compositeFor(identityOf(rows[0]), rows[0]) }],
      (r) => r.k,
      (r) => r.rid,
    );
    const { toCreate, toUpdate } = partitionImport(rows, existing, candidatesFor, primaryFor);
    expect(toCreate.map((r) => r.studentId)).toEqual(["222"]);
    expect(toUpdate).toEqual([{ row: rows[0], existingId: "e1" }]);
  });

  it("collapses within-file duplicate composite keys (last-wins)", () => {
    const first = { studentId: "111", pendingStudentId: null, firstName: "f", lastName: "l", awardName: "A", year: 2568 };
    const last = { studentId: "111", pendingStudentId: null, firstName: "f2", lastName: "l2", awardName: "A", year: 2568 };
    // Same primary composite (`id:111|A|2568`), different name — last must win.
    const { toCreate, toUpdate } = partitionImport([first, last], new Map(), candidatesFor, primaryFor);
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0].firstName).toBe("f2"); // last value wins
    expect(toUpdate).toEqual([]);
  });

  it("matches an id'd incoming row to an existing id-less row by name (name-fallback)", () => {
    // Existing id-less row registered under the name key.
    const existing = buildExistingKeyMap(
      [{ rid: "e9", k: `name:f|l|A|2568` }],
      (r) => r.k,
      (r) => r.rid,
    );
    // Incoming row HAS a studentId (so primary candidate is id:), but should still
    // match the existing id-less row via the secondary name candidate.
    const row: AwardRow = { studentId: "333", pendingStudentId: null, firstName: "f", lastName: "l", awardName: "A", year: 2568 };
    const { toCreate, toUpdate } = partitionImport([row], existing, candidatesFor, primaryFor);
    expect(toCreate).toEqual([]);
    expect(toUpdate).toEqual([{ row, existingId: "e9" }]);
  });

  it("treats a pending (unlinked) row by its pending id", () => {
    const row: AwardRow = { studentId: null, pendingStudentId: "444", firstName: "f", lastName: "l", awardName: "A", year: 2568 };
    const existing = buildExistingKeyMap(
      [{ rid: "e4", k: `pid:444|A|2568` }],
      (r) => r.k,
      (r) => r.rid,
    );
    const { toCreate, toUpdate } = partitionImport([row], existing, candidatesFor, primaryFor);
    expect(toUpdate).toEqual([{ row, existingId: "e4" }]);
    expect(toCreate).toEqual([]);
  });

  it("returns all-create when nothing exists", () => {
    const rows = [
      { studentId: "111", pendingStudentId: null, firstName: "f", lastName: "l", awardName: "A", year: 2568 },
      { studentId: null, pendingStudentId: null, firstName: "g", lastName: "h", awardName: "B", year: 2568 },
    ];
    const { toCreate, toUpdate } = partitionImport(rows, new Map(), candidatesFor, primaryFor);
    expect(toCreate).toHaveLength(2);
    expect(toUpdate).toEqual([]);
  });

  it("does not collapse rows that share a name but differ in natural key", () => {
    const a: AwardRow = { studentId: null, pendingStudentId: null, firstName: "f", lastName: "l", awardName: "A", year: 2568 };
    const b: AwardRow = { studentId: null, pendingStudentId: null, firstName: "f", lastName: "l", awardName: "B", year: 2568 };
    const { toCreate } = partitionImport([a, b], new Map(), candidatesFor, primaryFor);
    expect(toCreate).toHaveLength(2);
  });
});

describe("linkResultFromMap", () => {
  const map = new Map<string, { id: string; major: string | null }>([
    ["111", { id: "a1", major: "เวชศาสตร์ครอบครัว" }],
    ["222", { id: "a2", major: null }],
  ]);

  it("blank attempted id → both null", () => {
    expect(linkResultFromMap("", null, map)).toEqual({ studentId: null, pendingStudentId: null, major: null, linked: false });
    expect(linkResultFromMap(null, "fallback", map)).toEqual({ studentId: null, pendingStudentId: null, major: "fallback", linked: false });
  });

  it("hit → linked, major back-filled from the alumni", () => {
    expect(linkResultFromMap("111", null, map)).toEqual({ studentId: "111", pendingStudentId: null, major: "เวชศาสตร์ครอบครัว", linked: true });
  });

  it("hit but alumni major is null → keeps currentMajor", () => {
    expect(linkResultFromMap("222", "fallback", map)).toEqual({ studentId: "222", pendingStudentId: null, major: "fallback", linked: true });
  });

  it("miss → pending, major stays currentMajor", () => {
    expect(linkResultFromMap("999", "fallback", map)).toEqual({ studentId: null, pendingStudentId: "999", major: "fallback", linked: false });
  });

  it("trims the attempted id", () => {
    expect(linkResultFromMap("  111  ", null, map)).toEqual({ studentId: "111", pendingStudentId: null, major: "เวชศาสตร์ครอบครัว", linked: true });
  });
});

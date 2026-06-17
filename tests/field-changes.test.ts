import { describe, it, expect } from "vitest";
import { computeFieldChanges, TRACKED_FIELDS } from "@/lib/field-changes";

describe("computeFieldChanges", () => {
  it("returns only fields that actually changed", () => {
    const old = { awardName: "A", year: 2568, description: "x" };
    const next = { awardName: "B", year: 2568, description: "x" };
    const changes = computeFieldChanges(old, next, TRACKED_FIELDS.award);
    expect(changes).toEqual([{ field: "awardName", from: "A", to: "B" }]);
  });

  it("coerces numbers/null and ignores equal values", () => {
    const old = { year: 2568, description: null };
    const next = { year: 2569, description: null };
    const changes = computeFieldChanges(old, next, ["year", "description"]);
    expect(changes).toEqual([{ field: "year", from: "2568", to: "2569" }]);
  });

  it("treats a missing old record as all-new", () => {
    const next = { awardName: "A", year: 2568 };
    const changes = computeFieldChanges(null, next, ["awardName", "year"]);
    expect(changes).toEqual([
      { field: "awardName", from: null, to: "A" },
      { field: "year", from: null, to: "2568" },
    ]);
  });

  it("ignores fields outside the tracked list", () => {
    const old = { studentId: "1", awardName: "A" };
    const next = { studentId: "2", awardName: "A" };
    const changes = computeFieldChanges(old, next, TRACKED_FIELDS.award);
    expect(changes).toEqual([]); // studentId isn't tracked for awards
  });
});

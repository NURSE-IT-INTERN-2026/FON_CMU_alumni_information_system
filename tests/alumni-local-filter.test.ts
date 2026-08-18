import { describe, expect, it } from "vitest";
import {
  filterLocalAlumniRows,
  type LocalAlumniFilterInput,
} from "@/lib/alumni-local-filter";

type Row = LocalAlumniFilterInput & { id: string };

/** Minimal factory for a local row (only the fields the filter reads). */
const row = (over: Partial<Row> & { id: string; studentId: string }): Row => ({
  firstName: "สมหญิง",
  lastName: "ใจดี",
  degreeLevel: "BACHELOR",
  major: "พยาบาลศาสตร์",
  graduationYear: 2560,
  educations: [],
  ...over,
});

describe("filterLocalAlumniRows — search", () => {
  it("matches on firstName, lastName, studentId, and an education studentId (OR)", () => {
    const rows = [
      row({ id: "1", studentId: "66001", firstName: "สมหญิง" }),
      row({ id: "2", studentId: "66002", firstName: "มาลี", lastName: "รักไทย" }),
      row({ id: "3", studentId: "66003", firstName: "อื่น", lastName: "อื่น" }),
      row({ id: "4", studentId: "77777", firstName: "อื่น", lastName: "อื่น", educations: [{ studentId: "66004" }] }),
    ];
    // "66004" only exists as an education studentId — must still be findable
    // (the all-alumni show-all view relies on this).
    expect(filterLocalAlumniRows(rows, { search: "66004" }).map((r) => r.id)).toEqual(["4"]);
    expect(filterLocalAlumniRows(rows, { search: "สมหญิง" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterLocalAlumniRows(rows, { search: "รักไทย" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterLocalAlumniRows(rows, { search: "66002" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("is case-insensitive (Prisma contains insensitive parity)", () => {
    const rows = [row({ id: "1", studentId: "66001", firstName: "Somjing" })];
    expect(filterLocalAlumniRows(rows, { search: "somjing" })).toHaveLength(1);
    expect(filterLocalAlumniRows(rows, { search: "SOMJING" })).toHaveLength(1);
  });

  it("does NOT trim the search term (route parity: raw string straight into contains)", () => {
    const rows = [row({ id: "1", studentId: "66001", firstName: "สมหญิง" })];
    // A padded term matches nothing — same as the server (the CMU side trims;
    // the local side intentionally does not).
    expect(filterLocalAlumniRows(rows, { search: " สมหญิง " })).toHaveLength(0);
  });

  it("empty string skips the search filter entirely (route's `if (search)`)", () => {
    const rows = [row({ id: "1", studentId: "66001" })];
    expect(filterLocalAlumniRows(rows, { search: "" })).toHaveLength(1);
    expect(filterLocalAlumniRows(rows, {})).toHaveLength(1);
  });

  it("null firstName/lastName never match (Prisma null contains parity)", () => {
    const rows = [row({ id: "1", studentId: "66001", firstName: null, lastName: null })];
    expect(filterLocalAlumniRows(rows, { search: "สม" })).toHaveLength(0);
  });
});

describe("filterLocalAlumniRows — facets", () => {
  const rows = [
    row({ id: "1", studentId: "66001", degreeLevel: "BACHELOR", major: "พยาบาลศาสตร์", graduationYear: 2560 }),
    row({ id: "2", studentId: "66002", degreeLevel: "MASTER", major: "ผดุงครรภ์", graduationYear: 2565 }),
    row({ id: "3", studentId: "66003", degreeLevel: null, major: null, graduationYear: null }),
  ];

  it("exact match within a facet, OR across selected values", () => {
    expect(filterLocalAlumniRows(rows, { degreeLevels: ["BACHELOR"] }).map((r) => r.id)).toEqual(["1"]);
    expect(filterLocalAlumniRows(rows, { degreeLevels: ["BACHELOR", "MASTER"] }).map((r) => r.id)).toEqual(["1", "2"]);
    expect(filterLocalAlumniRows(rows, { majors: ["ผดุงครรภ์"] }).map((r) => r.id)).toEqual(["2"]);
  });

  it("AND across different facets", () => {
    expect(
      filterLocalAlumniRows(rows, { degreeLevels: ["MASTER"], graduationYears: ["2565"] }).map((r) => r.id),
    ).toEqual(["2"]);
    expect(
      filterLocalAlumniRows(rows, { degreeLevels: ["MASTER"], graduationYears: ["2560"] }),
    ).toHaveLength(0);
  });

  it("graduationYear compares numerically (YEAR_FIELDS Number coercion)", () => {
    expect(filterLocalAlumniRows(rows, { graduationYears: ["2560"] }).map((r) => r.id)).toEqual(["1"]);
    // A non-numeric facet value coerces to NaN and matches nothing.
    expect(filterLocalAlumniRows(rows, { graduationYears: ["abc"] })).toHaveLength(0);
  });

  it("facet values are trimmed + empties dropped (parseFacetFilters parity)", () => {
    expect(filterLocalAlumniRows(rows, { degreeLevels: [" BACHELOR ", ""] }).map((r) => r.id)).toEqual(["1"]);
    expect(filterLocalAlumniRows(rows, { degreeLevels: ["  "] })).toHaveLength(3);
  });

  it("null columns never match a facet", () => {
    expect(filterLocalAlumniRows(rows, { degreeLevels: ["BACHELOR"] }).map((r) => r.id)).not.toContain("3");
    expect(filterLocalAlumniRows(rows, { graduationYears: ["2560"] }).map((r) => r.id)).not.toContain("3");
  });
});

describe("filterLocalAlumniRows — soft deletes", () => {
  it("keeps soft-deleted rows (the merge builds its deleted-studentId hide-set from them)", () => {
    const rows = [
      row({ id: "1", studentId: "66001" }),
      // A soft-deleted row carries deletedAt; the filter must not drop rows on
      // any deleted criterion (matching ?includeDeleted=true on the route).
      { ...row({ id: "2", studentId: "66002" }), deletedAt: new Date().toISOString() },
    ];
    const out = filterLocalAlumniRows(rows, {});
    expect(out).toHaveLength(2);
  });
});

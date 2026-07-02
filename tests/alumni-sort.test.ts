import { describe, it, expect } from "vitest";
import { compareAlumni, sortAlumni } from "@/lib/alumni-sort";

/** Concrete test row — a plain interface (no index signature), like the page's
 *  Alumni type. `graduationYear` is present so the numeric-sort branch is
 *  exercised (the functions are now unconstrained, but the field still hooks
 *  numeric comparison when named explicitly). */
interface TestRow {
  id: string;
  birthDate?: string | null;
  graduationYear?: number | null;
  firstName?: string;
  contactEmail?: string | null;
  email?: string | null;
}

const row = (over: TestRow): TestRow => ({ ...over });

describe("compareAlumni — birthDate", () => {
  it("orders ISO date strings chronologically ascending", () => {
    const earlier = row({ id: "a", birthDate: "1990-05-12T00:00:00.000Z" });
    const later = row({ id: "b", birthDate: "1995-01-03T00:00:00.000Z" });
    expect(compareAlumni(earlier, later, "birthDate")).toBeLessThan(0);
    expect(compareAlumni(later, earlier, "birthDate")).toBeGreaterThan(0);
    expect(compareAlumni(earlier, earlier, "birthDate")).toBe(0);
  });

  it("treats null birthDate as empty (sorts first in ascending)", () => {
    const empty = row({ id: "a", birthDate: null });
    const dated = row({ id: "b", birthDate: "1990-05-12T00:00:00.000Z" });
    expect(compareAlumni(empty, dated, "birthDate")).toBeLessThan(0);
    expect(compareAlumni(dated, empty, "birthDate")).toBeGreaterThan(0);
  });
});

describe("sortAlumni", () => {
  const rows: TestRow[] = [
    row({ id: "c", birthDate: "1995-01-03T00:00:00.000Z" }),
    row({ id: "a", birthDate: null }),
    row({ id: "b", birthDate: "1990-05-12T00:00:00.000Z" }),
  ];

  it("sorts by birthDate ascending (nulls first)", () => {
    const sorted = sortAlumni(rows, "birthDate", "asc");
    expect(sorted.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by birthDate descending (nulls last)", () => {
    const sorted = sortAlumni(rows, "birthDate", "desc");
    expect(sorted.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input array", () => {
    const original = rows.map((r) => r.id);
    sortAlumni(rows, "birthDate", "asc");
    expect(rows.map((r) => r.id)).toEqual(original);
  });

  it("sorts graduationYear numerically (not as a string)", () => {
    const years: TestRow[] = [
      row({ id: "x", graduationYear: 100 }),
      row({ id: "y", graduationYear: 20 }),
      row({ id: "z", graduationYear: 2569 }),
    ];
    const sorted = sortAlumni(years, "graduationYear", "asc").map(
      (r) => r.graduationYear,
    );
    expect(sorted).toEqual([20, 100, 2569]);
  });

  it("falls back to th-locale string comparison for other fields", () => {
    const names: TestRow[] = [
      row({ id: "1", firstName: "กานดา" }),
      row({ id: "2", firstName: "ขนุน" }),
      row({ id: "3", firstName: "จันทรา" }),
    ];
    const sorted = sortAlumni(names, "firstName", "asc").map(
      (r) => r.firstName,
    );
    expect(sorted).toEqual(["กานดา", "ขนุน", "จันทรา"]);
  });

  it("sorts contactEmail by the effective value (contactEmail || email)", () => {
    // The all-alumni "อีเมลติดต่อ" column shows contactEmail with a fallback to
    // the login email; sort must follow that same effective value so a row shown
    // via fallback isn't stranded with the empty rows.
    const rows: TestRow[] = [
      row({ id: "login-only", contactEmail: null, email: "zoe@x.com" }),
      row({ id: "neither", contactEmail: null, email: null }),
      row({ id: "contact", contactEmail: "amy@x.com", email: "other@x.com" }),
    ];
    const sorted = sortAlumni(rows, "contactEmail", "asc").map((r) => r.id);
    // ascending: empty first, then amy@x.com (contact), then zoe@x.com (login)
    expect(sorted).toEqual(["neither", "contact", "login-only"]);
  });
});

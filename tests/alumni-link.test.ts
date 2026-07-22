import { describe, expect, it } from "vitest";
import {
  pickHomeAddressMigrationCandidate,
  reconcilePendingRow,
} from "@/lib/alumni-link";

// Build an alumni_agency-shaped pending row for the migration helper.
function agencyRow(opts: {
  id: string;
  homeAddress?: string | null;
  updatedAt?: Date;
}) {
  return {
    id: opts.id,
    prefix: null,
    firstName: null,
    lastName: null,
    studentId: null,
    homeAddress: opts.homeAddress ?? null,
    updatedAt: opts.updatedAt ?? new Date(0),
  };
}

describe("pickHomeAddressMigrationCandidate", () => {
  it("returns null when the alumni already has a homeAddress", () => {
    expect(
      pickHomeAddressMigrationCandidate({
        alumniHomeAddress: "existing",
        agencyRows: [agencyRow({ id: "a1", homeAddress: "from agency" })],
      }),
    ).toBeNull();
  });

  it("returns null when the alumni address is whitespace-only (treated as empty) but no agency has one", () => {
    expect(
      pickHomeAddressMigrationCandidate({
        alumniHomeAddress: "   ",
        agencyRows: [agencyRow({ id: "a1", homeAddress: null })],
      }),
    ).toBeNull();
  });

  it("migrates from the single non-empty agency row when the alumni has none", () => {
    expect(
      pickHomeAddressMigrationCandidate({
        alumniHomeAddress: null,
        agencyRows: [agencyRow({ id: "a1", homeAddress: "123 Main St" })],
      }),
    ).toEqual({ id: "a1", homeAddress: "123 Main St" });
  });

  it("trims the migrated value", () => {
    expect(
      pickHomeAddressMigrationCandidate({
        alumniHomeAddress: null,
        agencyRows: [agencyRow({ id: "a1", homeAddress: "  123 Main St  " })],
      }),
    ).toEqual({ id: "a1", homeAddress: "123 Main St" });
  });

  it("skips agency rows whose homeAddress is empty/whitespace", () => {
    expect(
      pickHomeAddressMigrationCandidate({
        alumniHomeAddress: null,
        agencyRows: [
          agencyRow({ id: "a1", homeAddress: "   " }),
          agencyRow({ id: "a2", homeAddress: null }),
          agencyRow({ id: "a3", homeAddress: "real" }),
        ],
      }),
    ).toEqual({ id: "a3", homeAddress: "real" });
  });

  it("picks the most-recently-updated non-empty row", () => {
    expect(
      pickHomeAddressMigrationCandidate({
        alumniHomeAddress: null,
        agencyRows: [
          agencyRow({ id: "old", homeAddress: "old addr", updatedAt: new Date(100) }),
          agencyRow({ id: "new", homeAddress: "new addr", updatedAt: new Date(200) }),
        ],
      }),
    ).toEqual({ id: "new", homeAddress: "new addr" });
  });

  it("breaks ties on equal updatedAt by id ascending", () => {
    const t = new Date(100);
    expect(
      pickHomeAddressMigrationCandidate({
        alumniHomeAddress: null,
        agencyRows: [
          agencyRow({ id: "b", homeAddress: "b addr", updatedAt: t }),
          agencyRow({ id: "a", homeAddress: "a addr", updatedAt: t }),
        ],
      }),
    ).toEqual({ id: "a", homeAddress: "a addr" });
  });
});

const alumniName = { prefix: "นาย", firstName: "อนุชา", lastName: "รักไทย" };

describe("reconcilePendingRow", () => {
  it("overwrites differing names and flips the FK (award)", () => {
    const oldRow = {
      id: "w1",
      prefix: null,
      firstName: "สมชาย",
      lastName: "ใจดี",
      studentId: null,
    };
    const { updateData, changes } = reconcilePendingRow(oldRow, alumniName, "11111111", "award");

    expect(updateData).toEqual({
      studentId: "11111111",
      pendingStudentId: null,
      prefix: "นาย",
      firstName: "อนุชา",
      lastName: "รักไทย",
    });
    // award does NOT track studentId → only the differing names are logged.
    const changedFields = changes.map((c) => c.field).sort();
    expect(changedFields).toEqual(["firstName", "lastName", "prefix"]);
  });

  it("produces no field-change rows when names already match", () => {
    const oldRow = { id: "w2", prefix: "นาย", firstName: "อนุชา", lastName: "รักไทย", studentId: null };
    const { updateData, changes } = reconcilePendingRow(oldRow, alumniName, "11111111", "award");

    expect(updateData.studentId).toBe("11111111");
    expect(updateData.pendingStudentId).toBeNull();
    expect(changes).toEqual([]);
  });

  it("logs the studentId flip for alumni_agency (it tracks studentId)", () => {
    const oldRow = { id: "ag1", prefix: null, firstName: null, lastName: null, studentId: null };
    const { changes } = reconcilePendingRow(oldRow, alumniName, "11111111", "alumni_agency");

    const fields = changes.map((c) => c.field);
    expect(fields).toContain("studentId");
    expect(fields).toContain("firstName");
    expect(fields).toContain("lastName");
    expect(fields).toContain("prefix");
  });

  it("does NOT log studentId for the 5 non-agency entities", () => {
    for (const kind of ["award", "association", "graduate_committee", "potential", "model_representative"] as const) {
      const oldRow = { id: "x", prefix: "old", firstName: "old", lastName: "old", studentId: null };
      const { changes } = reconcilePendingRow(oldRow, alumniName, "11111111", kind);
      expect(changes.map((c) => c.field)).not.toContain("studentId");
    }
  });
});

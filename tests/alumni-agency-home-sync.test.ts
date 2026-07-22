import { describe, expect, it } from "vitest";
import {
  shouldSyncAgencyHomeAddress,
  shouldMirrorAlumniHomeAddress,
} from "@/lib/alumni-agency-home-sync";

describe("shouldSyncAgencyHomeAddress", () => {
  it("is false when the row is not linked (no studentId)", () => {
    expect(
      shouldSyncAgencyHomeAddress({ studentId: null, agencyHomeAddress: "x", alumniHomeAddress: null })
    ).toBe(false);
  });

  it("is false when the agency address is empty (never clears the alumni address)", () => {
    expect(
      shouldSyncAgencyHomeAddress({ studentId: "1", agencyHomeAddress: "", alumniHomeAddress: "old" })
    ).toBe(false);
  });

  it("is false when the agency address is whitespace-only", () => {
    expect(
      shouldSyncAgencyHomeAddress({ studentId: "1", agencyHomeAddress: "   ", alumniHomeAddress: "old" })
    ).toBe(false);
  });

  it("is false when the agency address is null", () => {
    expect(
      shouldSyncAgencyHomeAddress({ studentId: "1", agencyHomeAddress: null, alumniHomeAddress: "old" })
    ).toBe(false);
  });

  it("is false when the value is unchanged (already the alumni address)", () => {
    expect(
      shouldSyncAgencyHomeAddress({ studentId: "1", agencyHomeAddress: "same", alumniHomeAddress: "same" })
    ).toBe(false);
  });

  it("is true when promoting an empty alumni address to a new value", () => {
    expect(
      shouldSyncAgencyHomeAddress({ studentId: "1", agencyHomeAddress: "new", alumniHomeAddress: null })
    ).toBe(true);
  });

  it("is true when changing to a different value", () => {
    expect(
      shouldSyncAgencyHomeAddress({ studentId: "1", agencyHomeAddress: "new", alumniHomeAddress: "old" })
    ).toBe(true);
  });

  it("trims whitespace before comparing (spaces-only difference = unchanged)", () => {
    expect(
      shouldSyncAgencyHomeAddress({ studentId: "1", agencyHomeAddress: "same  ", alumniHomeAddress: "same" })
    ).toBe(false);
  });

  it("trims whitespace before comparing (real difference still detected)", () => {
    expect(
      shouldSyncAgencyHomeAddress({ studentId: "1", agencyHomeAddress: "  new  ", alumniHomeAddress: "old" })
    ).toBe(true);
  });
});

describe("shouldMirrorAlumniHomeAddress (alumni → agency)", () => {
  it("is true when the agency address differs from the alumni's (overwrite)", () => {
    expect(
      shouldMirrorAlumniHomeAddress({ agencyHomeAddress: "old agency", alumniHomeAddress: "new alumni" }),
    ).toBe(true);
  });

  it("is true when clearing — alumni empty propagates a clear to the agency (opposite of the agency→alumni policy)", () => {
    expect(
      shouldMirrorAlumniHomeAddress({ agencyHomeAddress: "still here", alumniHomeAddress: null }),
    ).toBe(true);
    expect(
      shouldMirrorAlumniHomeAddress({ agencyHomeAddress: "still here", alumniHomeAddress: "   " }),
    ).toBe(true);
  });

  it("is false when they already match", () => {
    expect(
      shouldMirrorAlumniHomeAddress({ agencyHomeAddress: "same", alumniHomeAddress: "same" }),
    ).toBe(false);
  });

  it("is false when both are empty (null vs whitespace normalize to empty)", () => {
    expect(
      shouldMirrorAlumniHomeAddress({ agencyHomeAddress: null, alumniHomeAddress: "  " }),
    ).toBe(false);
  });

  it("trims the alumni value before comparing", () => {
    expect(
      shouldMirrorAlumniHomeAddress({ agencyHomeAddress: "same", alumniHomeAddress: "same  " }),
    ).toBe(false);
  });
});

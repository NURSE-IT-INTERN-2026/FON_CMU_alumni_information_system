import { describe, expect, it } from "vitest";
import {
  SELECT_ALUMNI_PUBLIC_IDENTITY,
  formatAlumniPublicName,
  type AlumniPublicIdentity,
} from "@/lib/forum-identity";

describe("SELECT_ALUMNI_PUBLIC_IDENTITY — the single leak surface", () => {
  it("selects exactly the 7 public fields", () => {
    expect(Object.keys(SELECT_ALUMNI_PUBLIC_IDENTITY).sort()).toEqual(
      ["cohort", "degreeLevel", "firstName", "id", "lastName", "photoUrl", "prefix"].sort(),
    );
  });

  it("never selects contact / sensitive fields", () => {
    const keys = Object.keys(SELECT_ALUMNI_PUBLIC_IDENTITY);
    for (const forbidden of [
      "email",
      "contactEmail",
      "phones",
      "homeAddress",
      "citizenId",
      "birthDate",
      "cmuEmail",
      "passwordHash",
    ]) {
      expect(keys, `${forbidden} must not be selectable`).not.toContain(forbidden);
    }
  });

  it("every selected field is true (no false/0 entries)", () => {
    for (const [k, v] of Object.entries(SELECT_ALUMNI_PUBLIC_IDENTITY)) {
      expect(v, `${k} must be true`).toBe(true);
    }
  });
});

describe("formatAlumniPublicName", () => {
  it("joins prefix + first + last", () => {
    const a: AlumniPublicIdentity = {
      id: "x",
      prefix: "นางสาว",
      firstName: "สมหญิง",
      lastName: "รักเรียน",
      cohort: "52",
      degreeLevel: "BACHELOR",
      photoUrl: null,
    };
    expect(formatAlumniPublicName(a)).toBe("นางสาวสมหญิง รักเรียน");
  });
});

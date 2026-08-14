import { describe, expect, it } from "vitest";
import {
  SELECT_ALUMNI_PUBLIC_IDENTITY,
  SELECT_ALUMNI_DIRECTORY_IDENTITY,
  formatAlumniPublicName,
  type AlumniPublicIdentity,
} from "@/lib/forum-identity";

const FORBIDDEN_ALUMNI_FIELDS = [
  "email",
  "contactEmail",
  "phones",
  "homeAddress",
  "citizenId",
  "birthDate",
  "cmuEmail",
  "passwordHash",
];

describe("SELECT_ALUMNI_PUBLIC_IDENTITY — the forum/feed leak surface", () => {
  it("selects exactly the 7 public fields", () => {
    expect(Object.keys(SELECT_ALUMNI_PUBLIC_IDENTITY).sort()).toEqual(
      ["cohort", "degreeLevel", "firstName", "id", "lastName", "photoUrl", "prefix"].sort(),
    );
  });

  it("never selects contact / sensitive fields", () => {
    const keys = Object.keys(SELECT_ALUMNI_PUBLIC_IDENTITY);
    for (const forbidden of FORBIDDEN_ALUMNI_FIELDS) {
      expect(keys, `${forbidden} must not be selectable`).not.toContain(forbidden);
    }
  });

  it("every selected field is true (no false/0 entries)", () => {
    for (const [k, v] of Object.entries(SELECT_ALUMNI_PUBLIC_IDENTITY)) {
      expect(v, `${k} must be true`).toBe(true);
    }
  });
});

describe("SELECT_ALUMNI_DIRECTORY_IDENTITY — the directory-only leak surface (V2)", () => {
  it("extends the public fragment with only graduationYear + communityProfile", () => {
    expect(Object.keys(SELECT_ALUMNI_DIRECTORY_IDENTITY).sort()).toEqual(
      [
        "cohort",
        "degreeLevel",
        "firstName",
        "graduationYear",
        "id",
        "lastName",
        "photoUrl",
        "prefix",
        "communityProfile",
      ].sort(),
    );
  });

  it("never selects Alumni-level contact / sensitive fields", () => {
    const keys = Object.keys(SELECT_ALUMNI_DIRECTORY_IDENTITY);
    for (const forbidden of FORBIDDEN_ALUMNI_FIELDS) {
      expect(keys, `${forbidden} must not be selectable`).not.toContain(forbidden);
    }
  });

  it("selects only the self-published CommunityProfile columns (no alumniId / ids)", () => {
    expect(Object.keys(SELECT_ALUMNI_DIRECTORY_IDENTITY.communityProfile.select).sort()).toEqual(
      [
        "bio",
        "contactEmail",
        "country",
        "currentPosition",
        "currentWorkplace",
        "facebookUrl",
        "lineId",
        "linkedinUrl",
        "otherLink",
        "photoUrl",
        "province",
      ].sort(),
    );
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

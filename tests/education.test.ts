import { describe, it, expect } from "vitest";
import {
  educationCreateSchema,
  educationUpdateSchema,
} from "../lib/validations/education";

describe("educationCreateSchema", () => {
  it("parses a complete, valid education record", () => {
    const out = educationCreateSchema.parse({
      studentId: "360000001",
      degreeLevel: "DOCTORAL",
      graduationYear: "2569",
      major: "การพยาบาล",
      cohort: "2569",
    });
    expect(out.studentId).toBe("360000001");
    expect(out.degreeLevel).toBe("DOCTORAL");
    expect(out.graduationYear).toBe(2569); // numeric string coerced to number
    expect(out.major).toBe("การพยาบาล");
  });

  it("coerces an empty graduationYear to null", () => {
    const out = educationCreateSchema.parse({
      studentId: "360000001",
      degreeLevel: "BACHELOR",
      graduationYear: "",
    });
    expect(out.graduationYear).toBeNull();
  });

  it("rejects a non-numeric graduationYear", () => {
    expect(() =>
      educationCreateSchema.parse({
        studentId: "360000001",
        degreeLevel: "BACHELOR",
        graduationYear: "abc",
      }),
    ).toThrow();
  });

  it("rejects a missing studentId", () => {
    expect(() =>
      educationCreateSchema.parse({ studentId: "", degreeLevel: "BACHELOR" }),
    ).toThrow();
  });

  it("rejects a non-numeric studentId", () => {
    expect(() =>
      educationCreateSchema.parse({ studentId: "abc123", degreeLevel: "BACHELOR" }),
    ).toThrow();
  });

  it("rejects an invalid degreeLevel", () => {
    expect(() =>
      educationCreateSchema.parse({ studentId: "360000001", degreeLevel: "PHD" }),
    ).toThrow();
  });

  it("accepts all five valid degree levels", () => {
    for (const level of ["DOCTORAL", "MASTER", "BACHELOR", "ASSOCIATE", "NURSING_ASSISTANT"]) {
      const out = educationCreateSchema.parse({ studentId: "1", degreeLevel: level });
      expect(out.degreeLevel).toBe(level);
    }
  });

  it("treats major/cohort as nullable/optional", () => {
    const out = educationCreateSchema.parse({
      studentId: "1",
      degreeLevel: "BACHELOR",
      graduationYear: null,
      major: null,
      cohort: null,
    });
    expect(out.graduationYear).toBeNull();
    expect(out.major).toBeNull();
    expect(out.cohort).toBeNull();
  });
});

describe("educationUpdateSchema", () => {
  it("parses an empty object (all fields optional)", () => {
    const out = educationUpdateSchema.parse({});
    expect(out.studentId).toBeUndefined();
    expect(out.degreeLevel).toBeUndefined();
  });

  it("accepts a partial update (degreeLevel only)", () => {
    const out = educationUpdateSchema.parse({ degreeLevel: "MASTER" });
    expect(out.degreeLevel).toBe("MASTER");
    expect(out.studentId).toBeUndefined();
  });

  it("coerces graduationYear empty→null and numeric→number", () => {
    expect(educationUpdateSchema.parse({ graduationYear: "" }).graduationYear).toBeNull();
    expect(educationUpdateSchema.parse({ graduationYear: "2560" }).graduationYear).toBe(2560);
  });

  it("still validates studentId format when provided", () => {
    expect(() => educationUpdateSchema.parse({ studentId: "abc" })).toThrow();
  });
});

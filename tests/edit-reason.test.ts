import { describe, it, expect } from "vitest";
import {
  awardUpdateSchema,
  associationUpdateSchema,
  alumniAgencyUpdateSchema,
  alumniUpdateSchema,
  alumniProfileUpdateSchema,
} from "@/lib/validations";

// PRD §3.11 / §3.1.4 — every record edit must capture a Reason
// [แก้ไขให้ถูกต้อง, อัปเดตข้อมูล] with no default. These schemas back the
// admin PUT routes and the alumni self-edit; reason must be required.
describe("edit reason is required on update schemas", () => {
  const schemas = [
    ["awardUpdateSchema", awardUpdateSchema, {}],
    ["associationUpdateSchema", associationUpdateSchema, {}],
    ["alumniAgencyUpdateSchema", alumniAgencyUpdateSchema, {}],
    ["alumniUpdateSchema", alumniUpdateSchema, {}],
  ] as const;

  it.each(schemas)("%s rejects a payload without a reason", (_name, schema, base) => {
    expect(() => schema.parse(base)).toThrow();
  });

  it.each(schemas)(
    "%s accepts a payload with a valid reason",
    (_name, schema, base) => {
      expect(() => schema.parse({ ...base, reason: "แก้ไขให้ถูกต้อง" })).not.toThrow();
      expect(() => schema.parse({ ...base, reason: "อัปเดตข้อมูล" })).not.toThrow();
    },
  );

  it.each(schemas)("%s rejects an invalid reason value", (_name, schema, base) => {
    expect(() => schema.parse({ ...base, reason: "bogus" })).toThrow();
  });

  it("alumniProfileUpdateSchema (self-edit) requires a reason", () => {
    const core = { prefix: "นาย", firstName: "สมชาย", lastName: "ใจดี" };
    expect(() => alumniProfileUpdateSchema.parse(core)).toThrow();
    expect(() =>
      alumniProfileUpdateSchema.parse({ ...core, reason: "แก้ไขให้ถูกต้อง" }),
    ).not.toThrow();
  });
});

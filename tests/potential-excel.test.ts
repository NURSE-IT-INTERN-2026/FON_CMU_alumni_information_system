import { describe, it, expect } from "vitest";
import {
  POTENTIAL_EXPORT_COLUMNS,
  potentialToExportRow,
  parsePotentialRow,
} from "@/lib/potential-excel";

/**
 * Pin the potentials Excel export/import contract:
 *   1. The export column layout mirrors the potentials management table (order +
 *      labels), with ลำดับ/จัดการ excluded.
 *   2. An exported row round-trips through the import parser (name/career/
 *      position/recordedYear), regardless of column order and for BOTH the
 *      page/export year header and the legacy one.
 *
 * (Potentials has no image/asset field and no export-only optional field that
 *  needs blank-protection — `major` is alumni-derived at the route layer, so it
 *  is intentionally not read by the parser. There is therefore no "ignore blank
 *  X" behavior to pin here, unlike awards/alumni.)
 */

const potential = {
  studentId: "640612001",
  pendingStudentId: null,
  prefix: "นางสาว",
  firstName: "สมหญิง",
  lastName: "ดี",
  career: "พยาบาลวิชาชีพ",
  position: "หัวหน้าหอผู้ป่วย",
  major: "การพยาบาลเด็ก",
  recordedYear: 2568,
};

const stringifyRow = (row: Record<string, string | number>): Record<string, string> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]));

describe("POTENTIAL_EXPORT_COLUMNS", () => {
  it("matches the potentials management table order (data columns only)", () => {
    expect([...POTENTIAL_EXPORT_COLUMNS]).toEqual([
      "รหัสนักศึกษา",
      "คำนำหน้า",
      "ชื่อ",
      "นามสกุล",
      "อาชีพ",
      "ตำแหน่ง",
      "สาขาวิชา",
      "ปีที่บันทึก",
    ]);
  });

  it("does not export the row-number or actions columns", () => {
    expect(POTENTIAL_EXPORT_COLUMNS).not.toContain("ลำดับ");
    expect(POTENTIAL_EXPORT_COLUMNS).not.toContain("จัดการ");
  });
});

describe("potentialToExportRow", () => {
  it("emits keys in the exact POTENTIAL_EXPORT_COLUMNS order", () => {
    expect(Object.keys(potentialToExportRow(potential))).toEqual([...POTENTIAL_EXPORT_COLUMNS]);
  });

  it("falls back to pendingStudentId when studentId is absent", () => {
    const row = potentialToExportRow({ ...potential, studentId: null, pendingStudentId: "PENDING-001" });
    expect(row["รหัสนักศึกษา"]).toBe("PENDING-001");
  });
});

describe("potentials export → import round-trip", () => {
  it("an exported row re-parses to the same fields", () => {
    const exported = stringifyRow(potentialToExportRow(potential));
    const { data, error } = parsePotentialRow(exported, 2);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      attemptedStudentId: "640612001",
      prefix: "นางสาว",
      firstName: "สมหญิง",
      lastName: "ดี",
      career: "พยาบาลวิชาชีพ",
      position: "หัวหน้าหอผู้ป่วย",
      recordedYear: 2568,
    });
  });

  it("parses regardless of column order (the parser is header-keyed)", () => {
    const exported = stringifyRow(potentialToExportRow(potential));
    const shuffled: Record<string, string> = {};
    for (const key of Object.keys(exported).reverse()) {
      shuffled[key] = exported[key];
    }
    const { data, error } = parsePotentialRow(shuffled, 2);
    expect(error).toBeNull();
    expect(data!.career).toBe("พยาบาลวิชาชีพ");
    expect(data!.recordedYear).toBe(2568);
  });

  it("accepts the legacy year header too (existing exports still parse)", () => {
    const legacyRow: Record<string, string> = {
      "รหัสนักศึกษา": "640612001",
      "คำนำหน้า": "นางสาว",
      "ชื่อ": "สมหญิง",
      "นามสกุล": "ดี",
      "อาชีพ": "พยาบาลวิชาชีพ",
      "ตำแหน่ง": "หัวหน้าหอผู้ป่วย",
      "ปีที่บันทึก (พ.ศ.)": "2568",
    };
    const { data, error } = parsePotentialRow(legacyRow, 2);
    expect(error).toBeNull();
    expect(data!.recordedYear).toBe(2568);
  });

  it("ignores the สาขาวิชา column (major is alumni-derived, not column-sourced)", () => {
    const exported = stringifyRow(potentialToExportRow(potential));
    // The exported row carries สาขาวิชา, but the parsed record has no major field.
    expect(exported["สาขาวิชา"]).toBe("การพยาบาลเด็ก");
    const { data } = parsePotentialRow(exported, 2);
    expect(data).not.toHaveProperty("major");
  });

  it("falls back to the legacy combined ชื่อ-สกุล column when ชื่อ/นามสกุล are absent", () => {
    const row: Record<string, string> = {
      "รหัสนักศึกษา": "640612001",
      "ชื่อ-สกุล": "นาย สมชาย ใจดี",
      "อาชีพ": "พยาบาล",
      "ตำแหน่ง": "พยาบาลวิชาชีพ",
      "ปีที่บันทึก": "2568",
    };
    const { data, error } = parsePotentialRow(row, 2);
    expect(error).toBeNull();
    expect(data!.firstName).toBe("สมชาย");
    expect(data!.lastName).toBe("ใจดี");
  });

  it("rejects a row missing a required field or with a non-numeric year", () => {
    const exported = stringifyRow(potentialToExportRow(potential));
    const missingCareer = { ...exported, "อาชีพ": "" };
    expect(parsePotentialRow(missingCareer, 2).error?.message).toBe("ข้อมูลที่จำเป็นไม่ครบถ้วน");
    const badYear = { ...exported, "ปีที่บันทึก": "two-thousand" };
    expect(parsePotentialRow(badYear, 2).error?.message).toBe("ปีที่บันทึกไม่ถูกต้อง");
  });
});

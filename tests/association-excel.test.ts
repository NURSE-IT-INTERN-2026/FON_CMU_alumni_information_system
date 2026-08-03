import { describe, it, expect } from "vitest";
import {
  ASSOCIATION_EXPORT_COLUMNS,
  associationToExportRow,
  parseAssociationRow,
} from "@/lib/association-excel";

/**
 * Pin the associations Excel export/import contract:
 *   1. The export column layout mirrors the associations management table (order
 *      + labels), with ลำดับ/จัดการ excluded.
 *   2. An exported row round-trips through the import parser (name/
 *      associationName/position/recordedYear), regardless of column order and for
 *      BOTH the page/export year header and the legacy one.
 *
 * (Associations has no image/asset field and no export-only optional field that
 *  needs blank-protection — `major` is alumni-derived at the route layer, so it
 *  is intentionally not read by the parser. There is therefore no "ignore blank
 *  X" behavior to pin here, unlike awards/alumni.)
 */

const association = {
  studentId: "640612001",
  pendingStudentId: null,
  prefix: "นางสาว",
  firstName: "สมหญิง",
  lastName: "ดี",
  associationName: "สมาคมพยาบาลแห่งประเทศไทย",
  position: "กรรมการ",
  major: "การพยาบาลเด็ก",
  recordedYear: 2568,
};

const stringifyRow = (row: Record<string, string | number>): Record<string, string> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]));

describe("ASSOCIATION_EXPORT_COLUMNS", () => {
  it("matches the associations management table order (data columns only)", () => {
    expect([...ASSOCIATION_EXPORT_COLUMNS]).toEqual([
      "รหัสนักศึกษา",
      "คำนำหน้า",
      "ชื่อ",
      "นามสกุล",
      "ชื่อสมาคม/ชมรม",
      "ตำแหน่ง",
      "สาขาวิชา",
      "ปีที่บันทึก",
    ]);
  });

  it("does not export the row-number or actions columns", () => {
    expect(ASSOCIATION_EXPORT_COLUMNS).not.toContain("ลำดับ");
    expect(ASSOCIATION_EXPORT_COLUMNS).not.toContain("จัดการ");
  });
});

describe("associationToExportRow", () => {
  it("emits keys in the exact ASSOCIATION_EXPORT_COLUMNS order", () => {
    expect(Object.keys(associationToExportRow(association))).toEqual([...ASSOCIATION_EXPORT_COLUMNS]);
  });

  it("falls back to pendingStudentId when studentId is absent", () => {
    const row = associationToExportRow({ ...association, studentId: null, pendingStudentId: "PENDING-001" });
    expect(row["รหัสนักศึกษา"]).toBe("PENDING-001");
  });
});

describe("associations export → import round-trip", () => {
  it("an exported row re-parses to the same fields", () => {
    const exported = stringifyRow(associationToExportRow(association));
    const { data, error } = parseAssociationRow(exported, 2);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      attemptedStudentId: "640612001",
      prefix: "นางสาว",
      firstName: "สมหญิง",
      lastName: "ดี",
      associationName: "สมาคมพยาบาลแห่งประเทศไทย",
      position: "กรรมการ",
      recordedYear: 2568,
    });
  });

  it("parses regardless of column order (the parser is header-keyed)", () => {
    const exported = stringifyRow(associationToExportRow(association));
    const shuffled: Record<string, string> = {};
    for (const key of Object.keys(exported).reverse()) {
      shuffled[key] = exported[key];
    }
    const { data, error } = parseAssociationRow(shuffled, 2);
    expect(error).toBeNull();
    expect(data!.associationName).toBe("สมาคมพยาบาลแห่งประเทศไทย");
    expect(data!.recordedYear).toBe(2568);
  });

  it("accepts the legacy year header too (existing exports still parse)", () => {
    const legacyRow: Record<string, string> = {
      "รหัสนักศึกษา": "640612001",
      "คำนำหน้า": "นางสาว",
      "ชื่อ": "สมหญิง",
      "นามสกุล": "ดี",
      "ชื่อสมาคม/ชมรม": "สมาคมพยาบาล",
      "ตำแหน่ง": "กรรมการ",
      "ปีที่บันทึก (พ.ศ.)": "2568",
    };
    const { data, error } = parseAssociationRow(legacyRow, 2);
    expect(error).toBeNull();
    expect(data!.recordedYear).toBe(2568);
  });

  it("ignores the สาขาวิชา column (major is alumni-derived, not column-sourced)", () => {
    const exported = stringifyRow(associationToExportRow(association));
    expect(exported["สาขาวิชา"]).toBe("การพยาบาลเด็ก");
    const { data } = parseAssociationRow(exported, 2);
    expect(data).not.toHaveProperty("major");
  });

  it("falls back to the legacy combined ชื่อ-สกุล column when ชื่อ/นามสกุล are absent", () => {
    const row: Record<string, string> = {
      "รหัสนักศึกษา": "640612001",
      "ชื่อ-สกุล": "นาย สมชาย ใจดี",
      "ชื่อสมาคม/ชมรม": "สมาคมพยาบาล",
      "ตำแหน่ง": "สมาชิก",
      "ปีที่บันทึก": "2568",
    };
    const { data, error } = parseAssociationRow(row, 2);
    expect(error).toBeNull();
    expect(data!.firstName).toBe("สมชาย");
    expect(data!.lastName).toBe("ใจดี");
  });

  it("rejects a row missing a required field or with a non-numeric year", () => {
    const exported = stringifyRow(associationToExportRow(association));
    const missingName = { ...exported, "ชื่อสมาคม/ชมรม": "" };
    expect(parseAssociationRow(missingName, 2).error?.message).toBe("ข้อมูลที่จำเป็นไม่ครบถ้วน");
    const badYear = { ...exported, "ปีที่บันทึก": "two-thousand" };
    expect(parseAssociationRow(badYear, 2).error?.message).toBe("ปีที่บันทึกไม่ถูกต้อง");
  });
});

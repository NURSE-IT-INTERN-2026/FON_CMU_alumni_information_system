import { describe, it, expect } from "vitest";
import {
  COMMITTEE_EXPORT_COLUMNS,
  committeeToExportRow,
  parseCommitteeRow,
} from "@/lib/graduate-committee-excel";

/**
 * Pin the graduate-committee Excel export/import contract:
 *   1. The export column layout mirrors the management table (order + labels),
 *      with ลำดับ/จัดการ excluded.
 *   2. An exported row round-trips through the import parser (termYear/name/
 *      cohort/position/remarks), regardless of column order.
 *
 * (Graduate-committee has no image/asset field and no export-only optional field
 *  that needs blank-protection — `major` is alumni-derived at the route layer, so
 *  it is intentionally not read by the parser. There is therefore no "ignore
 *  blank X" behavior to pin here, unlike awards/alumni.)
 */

const committee = {
  studentId: "640612001",
  pendingStudentId: null,
  prefix: "นางสาว",
  firstName: "สมหญิง",
  lastName: "ดี",
  cohort: "รุ่น 5",
  termYear: 2568,
  position: "ประธานกรรมการ",
  major: "การพยาบาลเด็ก",
  remarks: "หมายเหตุทดสอบ",
};

const stringifyRow = (row: Record<string, string | number>): Record<string, string> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]));

describe("COMMITTEE_EXPORT_COLUMNS", () => {
  it("matches the graduate-committee management table order (data columns only)", () => {
    expect([...COMMITTEE_EXPORT_COLUMNS]).toEqual([
      "รหัสนักศึกษา",
      "คำนำหน้า",
      "ชื่อ",
      "นามสกุล",
      "รุ่นที่",
      "ปี พ.ศ.",
      "ตำแหน่ง",
      "สาขาวิชา",
      "หมายเหตุ",
    ]);
  });

  it("does not export the row-number or actions columns", () => {
    expect(COMMITTEE_EXPORT_COLUMNS).not.toContain("ลำดับ");
    expect(COMMITTEE_EXPORT_COLUMNS).not.toContain("จัดการ");
  });
});

describe("committeeToExportRow", () => {
  it("emits keys in the exact COMMITTEE_EXPORT_COLUMNS order", () => {
    expect(Object.keys(committeeToExportRow(committee))).toEqual([...COMMITTEE_EXPORT_COLUMNS]);
  });

  it("falls back to pendingStudentId when studentId is absent", () => {
    const row = committeeToExportRow({ ...committee, studentId: null, pendingStudentId: "PENDING-001" });
    expect(row["รหัสนักศึกษา"]).toBe("PENDING-001");
  });
});

describe("graduate-committee export → import round-trip", () => {
  it("an exported row re-parses to the same fields", () => {
    const exported = stringifyRow(committeeToExportRow(committee));
    const { data, error } = parseCommitteeRow(exported, 2);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      attemptedStudentId: "640612001",
      prefix: "นางสาว",
      firstName: "สมหญิง",
      lastName: "ดี",
      termYear: 2568,
      cohort: "รุ่น 5",
      position: "ประธานกรรมการ",
      remarks: "หมายเหตุทดสอบ",
    });
  });

  it("parses regardless of column order (the parser is header-keyed)", () => {
    const exported = stringifyRow(committeeToExportRow(committee));
    const shuffled: Record<string, string> = {};
    for (const key of Object.keys(exported).reverse()) {
      shuffled[key] = exported[key];
    }
    const { data, error } = parseCommitteeRow(shuffled, 2);
    expect(error).toBeNull();
    expect(data!.termYear).toBe(2568);
    expect(data!.position).toBe("ประธานกรรมการ");
  });

  it("ignores the สาขาวิชา column (major is alumni-derived, not column-sourced)", () => {
    const exported = stringifyRow(committeeToExportRow(committee));
    expect(exported["สาขาวิชา"]).toBe("การพยาบาลเด็ก");
    const { data } = parseCommitteeRow(exported, 2);
    expect(data).not.toHaveProperty("major");
  });

  it("falls back to the legacy combined ชื่อ-สกุล column when ชื่อ/นามสกุล are absent", () => {
    const row: Record<string, string> = {
      "ปี พ.ศ.": "2568",
      "รหัสนักศึกษา": "640612001",
      "ชื่อ-สกุล": "นาย สมชาย ใจดี",
      "รุ่นที่": "รุ่น 5",
      "ตำแหน่ง": "กรรมการ",
    };
    const { data, error } = parseCommitteeRow(row, 2);
    expect(error).toBeNull();
    expect(data!.firstName).toBe("สมชาย");
    expect(data!.lastName).toBe("ใจดี");
  });

  it("rejects a row missing a required field or with a non-numeric ปี พ.ศ.", () => {
    const exported = stringifyRow(committeeToExportRow(committee));
    const missingPosition = { ...exported, "ตำแหน่ง": "" };
    expect(parseCommitteeRow(missingPosition, 2).error?.message).toBe("ข้อมูลที่จำเป็นไม่ครบถ้วน");
    const badYear = { ...exported, "ปี พ.ศ.": "two-thousand" };
    expect(parseCommitteeRow(badYear, 2).error?.message).toBe("ปี พ.ศ. ไม่ถูกต้อง");
  });
});

import { describe, it, expect } from "vitest";
import {
  AWARD_EXPORT_COLUMNS,
  awardToExportRow,
  awardWritePayload,
} from "@/lib/award-excel";
import { parseAwardRow } from "@/lib/award-import-parse";

/**
 * Pin the awards Excel export/import contract:
 *   1. The export column layout mirrors the awards management table (order + labels),
 *      with the image path excluded.
 *   2. An exported row round-trips through the import parser (incl. the awardType
 *      Thai-label → enum conversion), regardless of column order and for BOTH the
 *      new (page-table) and legacy header labels.
 *   3. The import write payload ignores a blank imageUrl (so a round-tripped export
 *      never blanks an image set out-of-band).
 */

const sampleAward = {
  studentId: "640612001",
  pendingStudentId: null,
  prefix: "นางสาว",
  firstName: "สมหญิง",
  lastName: "ดี",
  major: "การพยาบาลเด็ก",
  awardName: "รางวัลพยาบาลดีเด่น",
  awardType: "NATIONAL",
  year: 2566,
  link: "https://example.com/award",
  description: "รายละเอียดรางวัล",
};

/** Mimic an ExcelJS cell read: every value becomes a string. */
const stringifyRow = (row: Record<string, string | number>): Record<string, string> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]));

describe("AWARD_EXPORT_COLUMNS", () => {
  it("matches the awards management table order (data columns only)", () => {
    expect([...AWARD_EXPORT_COLUMNS]).toEqual([
      "รหัสนักศึกษา",
      "สาขาวิชา",
      "คำนำหน้า",
      "ชื่อ",
      "นามสกุล",
      "ชื่อรางวัล",
      "ประเภท",
      "ปีที่ได้รับ",
      "ลิงค์",
      "รายละเอียด",
    ]);
  });

  it("does not export the image path, row number, or actions", () => {
    expect(AWARD_EXPORT_COLUMNS).not.toContain("รูปภาพ");
    expect(AWARD_EXPORT_COLUMNS).not.toContain("ลำดับ");
    expect(AWARD_EXPORT_COLUMNS).not.toContain("จัดการ");
  });
});

describe("awardToExportRow", () => {
  it("emits keys in the exact AWARD_EXPORT_COLUMNS order", () => {
    const row = awardToExportRow(sampleAward);
    expect(Object.keys(row)).toEqual([...AWARD_EXPORT_COLUMNS]);
  });

  it("maps the awardType enum to its Thai label", () => {
    expect(awardToExportRow(sampleAward)["ประเภท"]).toBe("รางวัลระดับชาติ");
  });

  it("falls back to pendingStudentId when studentId is absent", () => {
    const row = awardToExportRow({ ...sampleAward, studentId: null, pendingStudentId: "PENDING-001" });
    expect(row["รหัสนักศึกษา"]).toBe("PENDING-001");
  });
});

describe("awards export → import round-trip", () => {
  it("an exported row re-parses to the same fields (incl. awardType label → enum)", () => {
    const exported = stringifyRow(awardToExportRow(sampleAward));
    const { data, error } = parseAwardRow(exported, 2);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      studentId: "640612001",
      prefix: "นางสาว",
      firstName: "สมหญิง",
      lastName: "ดี",
      major: "การพยาบาลเด็ก",
      awardName: "รางวัลพยาบาลดีเด่น",
      awardType: "NATIONAL", // Thai label round-trips back to the enum
      year: 2566,
      link: "https://example.com/award",
      description: "รายละเอียดรางวัล",
    });
  });

  it("the exported row carries no รูปภาพ column, so imageUrl parses to null", () => {
    const exported = stringifyRow(awardToExportRow(sampleAward));
    expect(exported).not.toHaveProperty("รูปภาพ");
    const { data, error } = parseAwardRow(exported, 2);
    expect(error).toBeNull();
    expect(data!.imageUrl).toBeNull();
  });

  it("parses regardless of column order (the parser is header-keyed)", () => {
    const exported = stringifyRow(awardToExportRow(sampleAward));
    const shuffled: Record<string, string> = {};
    // Reverse the key order — order must not matter to the import.
    for (const key of Object.keys(exported).reverse()) {
      shuffled[key] = exported[key];
    }
    const { data, error } = parseAwardRow(shuffled, 2);
    expect(error).toBeNull();
    expect(data!.awardName).toBe("รางวัลพยาบาลดีเด่น");
    expect(data!.awardType).toBe("NATIONAL");
  });

  it("accepts the legacy header labels too (existing exports still import)", () => {
    const legacyRow: Record<string, string> = {
      "รหัสนักศึกษา": "640612001",
      "คำนำหน้า": "นางสาว",
      "ชื่อ": "สมหญิง",
      "นามสกุล": "ดี",
      "สาขาวิชา": "การพยาบาลเด็ก",
      "ชื่อรางวัล": "รางวัลพยาบาลดีเด่น",
      "ประเภทรางวัล": "รางวัลระดับชาติ",
      "ปี (พ.ศ.)": "2566",
    };
    const { data, error } = parseAwardRow(legacyRow, 2);
    expect(error).toBeNull();
    expect(data!.awardType).toBe("NATIONAL");
    expect(data!.year).toBe(2566);
  });
});

describe("awardWritePayload — empty imageUrl is ignored", () => {
  const baseRow = {
    studentId: "640612001",
    pendingStudentId: null,
    major: "การพยาบาลเด็ก",
    data: {
      studentId: "640612001",
      prefix: "นางสาว",
      firstName: "สมหญิง",
      lastName: "ดี",
      major: "การพยาบาลเด็ก",
      awardName: "รางวัลพยาบาลดีเด่น",
      awardType: "NATIONAL",
      year: 2566,
      link: null,
      imageUrl: null, // blank — a round-tripped export
      description: null,
    },
  };

  it("omits imageUrl from the payload when it is blank (preserves an existing image on update)", () => {
    const payload = awardWritePayload(baseRow);
    expect(payload).not.toHaveProperty("imageUrl");
  });

  it("includes imageUrl when the import provides one", () => {
    const payload = awardWritePayload({
      ...baseRow,
      data: { ...baseRow.data, imageUrl: "/uploads/award.png" },
    });
    expect(payload.imageUrl).toBe("/uploads/award.png");
  });
});

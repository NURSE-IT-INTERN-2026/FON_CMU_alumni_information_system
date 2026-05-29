import { describe, it, expect } from "vitest";
import { parseAwardRow, AWARD_TYPE_THAI_TO_ENUM } from "@/lib/award-import-parse";

describe("AWARD_TYPE_THAI_TO_ENUM", () => {
  it("maps Thai labels to enum keys", () => {
    expect(AWARD_TYPE_THAI_TO_ENUM["รางวัลระดับนานาชาติ"]).toBe("INTERNATIONAL");
    expect(AWARD_TYPE_THAI_TO_ENUM["รางวัลระดับชาติ"]).toBe("NATIONAL");
    expect(AWARD_TYPE_THAI_TO_ENUM["รางวัลระดับท้องถิ่น"]).toBe("LOCAL");
  });
});

describe("parseAwardRow", () => {
  const validRow: Record<string, string> = {
    "รหัสนักศึกษา": "640612001",
    "ชื่อ-นามสกุล": "สมหญิง ดี",
    "ชื่อรางวัล": "รางวัลพยาบาลดีเด่น",
    "ประเภทรางวัล": "รางวัลระดับชาติ",
    "ปี (พ.ศ.)": "2566",
    "รายละเอียด": "รายละเอียดรางวัล",
  };

  it("parses a valid row correctly", () => {
    const { data, error } = parseAwardRow(validRow, 2);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      studentId: "640612001",
      recipientName: "สมหญิง ดี",
      awardName: "รางวัลพยาบาลดีเด่น",
      awardType: "NATIONAL",
      year: 2566,
      description: "รายละเอียดรางวัล",
    });
  });

  it("returns null studentId when cell is empty", () => {
    const row = { ...validRow, "รหัสนักศึกษา": "" };
    const { data, error } = parseAwardRow(row, 2);
    expect(error).toBeNull();
    expect(data!.studentId).toBeNull();
  });

  it("returns null description when cell is empty", () => {
    const row = { ...validRow, "รายละเอียด": "" };
    const { data, error } = parseAwardRow(row, 2);
    expect(error).toBeNull();
    expect(data!.description).toBeNull();
  });

  it("error when awardName is missing", () => {
    const row = { ...validRow, "ชื่อรางวัล": "" };
    const { data, error } = parseAwardRow(row, 3);
    expect(data).toBeNull();
    expect(error).toMatchObject({ row: 3, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
  });

  it("error when ประเภทรางวัล is missing", () => {
    const row = { ...validRow, "ประเภทรางวัล": "" };
    const { data, error } = parseAwardRow(row, 4);
    expect(data).toBeNull();
    expect(error).toMatchObject({ row: 4, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
  });

  it("error when ปี is missing", () => {
    const row = { ...validRow, "ปี (พ.ศ.)": "" };
    const { data, error } = parseAwardRow(row, 5);
    expect(data).toBeNull();
    expect(error).toMatchObject({ row: 5, message: "ข้อมูลที่จำเป็นไม่ครบถ้วน" });
  });

  it("error when ประเภทรางวัล is an unrecognised value", () => {
    const row = { ...validRow, "ประเภทรางวัล": "รางวัลไม่รู้จัก" };
    const { data, error } = parseAwardRow(row, 6);
    expect(data).toBeNull();
    expect(error!.message).toContain("รางวัลไม่รู้จัก");
  });

  it("error when ปี is not a number", () => {
    const row = { ...validRow, "ปี (พ.ศ.)": "two-thousand" };
    const { data, error } = parseAwardRow(row, 7);
    expect(data).toBeNull();
    expect(error).toMatchObject({ row: 7, message: "ปี (พ.ศ.) ไม่ถูกต้อง" });
  });

  it("parses all three award types", () => {
    const types: [string, string][] = [
      ["รางวัลระดับนานาชาติ", "INTERNATIONAL"],
      ["รางวัลระดับชาติ", "NATIONAL"],
      ["รางวัลระดับท้องถิ่น", "LOCAL"],
    ];
    for (const [thai, enumKey] of types) {
      const row = { ...validRow, "ประเภทรางวัล": thai };
      const { data, error } = parseAwardRow(row, 2);
      expect(error).toBeNull();
      expect(data!.awardType).toBe(enumKey);
    }
  });

  it("trims whitespace from all fields", () => {
    const row: Record<string, string> = {
      "รหัสนักศึกษา": "  640612001  ",
      "ชื่อ-นามสกุล": "  สมหญิง ดี  ",
      "ชื่อรางวัล": "  รางวัลดีเด่น  ",
      "ประเภทรางวัล": "  รางวัลระดับชาติ  ",
      "ปี (พ.ศ.)": "  2566  ",
      "รายละเอียด": "  รายละเอียด  ",
    };
    const { data, error } = parseAwardRow(row, 2);
    expect(error).toBeNull();
    expect(data!.studentId).toBe("640612001");
    expect(data!.awardName).toBe("รางวัลดีเด่น");
    expect(data!.year).toBe(2566);
  });
});

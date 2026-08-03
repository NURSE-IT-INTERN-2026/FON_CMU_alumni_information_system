import { describe, it, expect } from "vitest";
import {
  AGENCY_THAILAND_COLUMNS,
  AGENCY_ABROAD_COLUMNS,
  AGENCY_FULL_COLUMNS,
  agencyToExportRow,
  agencyCreatePayload,
  agencyUpdatePayload,
  parseExportFormat,
  type ParsedAlumniAgencyRow,
} from "@/lib/alumni-agency-parse";

/**
 * Pin the alumni-agency Excel export/import contract — the region-aware one:
 *   1. The Thailand/Abroad exports mirror their tabs (ONE location column each,
 *      no ลำดับ); the POST/region-less export is the full superset.
 *   2. The export→import round-trips, INCLUDING the two relaxations a tab export
 *      needs: inferring `ประเทศไทย` from `จังหวัด`, and NOT blanking `order`.
 */

const thailandAgency = {
  studentId: "640612001",
  pendingStudentId: null,
  cohort: "รุ่น 5",
  prefix: "นางสาว",
  firstName: "สมหญิง",
  lastName: "ดี",
  englishName: "Somying",
  major: "การพยาบาลเด็ก",
  workplace: "โรงพยาบาลมหาราชนครเชียงใหม่",
  position: "พยาบาลวิชาชีพ",
  province: "เชียงใหม่",
  homeAddress: "111 ถ.ห้วยแก้ว",
  country: "ประเทศไทย",
  notes: "หมายเหตุ",
  order: 7,
};

const abroadAgency = { ...thailandAgency, country: "ญี่ปุ่น", province: null, englishName: "Somying JP" };

const stringifyRow = (row: Record<string, string | number>): Record<string, string> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]));

describe("AGENCY_*_COLUMNS", () => {
  it("THAILAND mirrors the Thailand tab (จังหวัด slot, no ประเทศ/ลำดับ/จัดการ)", () => {
    expect([...AGENCY_THAILAND_COLUMNS]).toEqual([
      "รหัสนักศึกษา", "รุ่น", "สาขาวิชา", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่ออังกฤษ",
      "จังหวัด", "สถานที่ทำงาน", "ตำแหน่ง", "ที่อยู่บ้าน", "หมายเหตุ",
    ]);
    expect(AGENCY_THAILAND_COLUMNS).not.toContain("ประเทศ");
    expect(AGENCY_THAILAND_COLUMNS).not.toContain("ลำดับ");
    expect(AGENCY_THAILAND_COLUMNS).not.toContain("จัดการ");
  });

  it("ABROAD mirrors the Abroad tab (ประเทศ slot, no จังหวัด/ลำดับ)", () => {
    expect([...AGENCY_ABROAD_COLUMNS]).toEqual([
      "รหัสนักศึกษา", "รุ่น", "สาขาวิชา", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่ออังกฤษ",
      "ประเทศ", "สถานที่ทำงาน", "ตำแหน่ง", "ที่อยู่บ้าน", "หมายเหตุ",
    ]);
    expect(AGENCY_ABROAD_COLUMNS).not.toContain("จังหวัด");
    expect(AGENCY_ABROAD_COLUMNS).not.toContain("ลำดับ");
  });

  it("FULL is the 14-column superset (both location cols + ลำดับ(order), no จัดการ)", () => {
    expect([...AGENCY_FULL_COLUMNS]).toEqual([
      "รหัสนักศึกษา", "รุ่น", "สาขาวิชา", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่ออังกฤษ",
      "จังหวัด", "ประเทศ", "สถานที่ทำงาน", "ตำแหน่ง", "ที่อยู่บ้าน", "หมายเหตุ", "ลำดับ",
    ]);
    expect(AGENCY_FULL_COLUMNS).not.toContain("จัดการ");
  });
});

describe("agencyToExportRow", () => {
  it("emits exactly the chosen columns in order", () => {
    expect(Object.keys(agencyToExportRow(thailandAgency, AGENCY_THAILAND_COLUMNS))).toEqual([...AGENCY_THAILAND_COLUMNS]);
    expect(Object.keys(agencyToExportRow(abroadAgency, AGENCY_ABROAD_COLUMNS))).toEqual([...AGENCY_ABROAD_COLUMNS]);
    expect(Object.keys(agencyToExportRow(thailandAgency, AGENCY_FULL_COLUMNS))).toEqual([...AGENCY_FULL_COLUMNS]);
  });

  it("falls back to pendingStudentId and maps the location slots correctly", () => {
    const row = agencyToExportRow({ ...thailandAgency, studentId: null, pendingStudentId: "PENDING-001" }, AGENCY_THAILAND_COLUMNS);
    expect(row["รหัสนักศึกษา"]).toBe("PENDING-001");
    expect(row["จังหวัด"]).toBe("เชียงใหม่");
    const abroadRow = agencyToExportRow(abroadAgency, AGENCY_ABROAD_COLUMNS);
    expect(abroadRow["ประเทศ"]).toBe("ญี่ปุ่น");
  });
});

describe("alumni-agency export → import round-trip (+ relaxations)", () => {
  it("a Thailand export (จังหวัด, no ประเทศ, no ลำดับ) re-parses with country inferred + order null", () => {
    const exported = stringifyRow(agencyToExportRow(thailandAgency, AGENCY_THAILAND_COLUMNS));
    expect(exported).not.toHaveProperty("ประเทศ");
    expect(exported).not.toHaveProperty("ลำดับ");
    const parsed = parseExportFormat([exported]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].data).toMatchObject({
      country: "ประเทศไทย", // inferred from จังหวัด
      province: "เชียงใหม่",
      order: null, // no ลำดับ column
      firstName: "สมหญิง",
      workplace: "โรงพยาบาลมหาราชนครเชียงใหม่",
    });
  });

  it("an Abroad export (ประเทศ, no จังหวัด) re-parses with its country", () => {
    const exported = stringifyRow(agencyToExportRow(abroadAgency, AGENCY_ABROAD_COLUMNS));
    const parsed = parseExportFormat([exported]);
    expect(parsed[0].data).toMatchObject({ country: "ญี่ปุ่น", province: null });
  });

  it("a full-superset export (ลำดับ present) re-parses with its order", () => {
    const exported = stringifyRow(agencyToExportRow(thailandAgency, AGENCY_FULL_COLUMNS));
    const parsed = parseExportFormat([exported]);
    expect(parsed[0].data).toMatchObject({ country: "ประเทศไทย", province: "เชียงใหม่", order: 7 });
  });

  it("still skips a row with neither ประเทศ nor จังหวัด", () => {
    expect(parseExportFormat([{ ชื่อ: "สมหญิง", นามสกุล: "ดี", ชื่ออังกฤษ: "Somying" }])).toHaveLength(0);
  });
});

describe("agency payloads — order is not blanked", () => {
  const baseData: ParsedAlumniAgencyRow = {
    cohort: "รุ่น 5", prefix: "นางสาว", firstName: "สมหญิง", lastName: "ดี", englishName: null,
    workplace: "wp", province: "เชียงใหม่", position: "พยาบาล", homeAddress: "addr",
    country: "ประเทศไทย", notes: null, order: null, studentId: "640612001", major: null, pendingStudentId: null,
  };

  it("UPDATE omits order when null (preserves the existing order)", () => {
    const payload = agencyUpdatePayload({ data: { ...baseData, order: null } });
    expect(payload).not.toHaveProperty("order");
  });

  it("UPDATE includes order when provided", () => {
    const payload = agencyUpdatePayload({ data: { ...baseData, order: 7 } });
    expect(payload.order).toBe(7);
  });

  it("CREATE defaults a null order to 0 (order is a required Int)", () => {
    expect(agencyCreatePayload({ data: { ...baseData, order: null } }).order).toBe(0);
    expect(agencyCreatePayload({ data: { ...baseData, order: 7 } }).order).toBe(7);
  });
});

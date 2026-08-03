import { describe, it, expect } from "vitest";
import {
  MODELREP_EXPORT_COLUMNS,
  modelRepToExportRow,
  parseModelRepRow,
} from "@/lib/model-representative-excel";

/**
 * Pin the model-representatives Excel export/import contract:
 *   1. The export column layout mirrors the management table (order + labels),
 *      with ลำดับ/จัดการ excluded.
 *   2. The INVERTED cohort/generation mapping is correct (the key gotcha for this
 *      entity): เครือข่าย ↔ `cohort`, รุ่นที่ ↔ `generation` — the OPPOSITE of
 *      sibling entities where `cohort` = รุ่นที่.
 *   3. An exported row round-trips through the import parser, regardless of
 *      column order and for BOTH the page/export `รุ่นที่` and legacy `ลำดับรุ่น`.
 *
 * (Model-representatives has no image/asset field and no export-only optional
 *  field that needs blank-protection — `major` is alumni-derived at the route
 *  layer, so it is intentionally not read by the parser. No "ignore blank X"
 *  behavior to pin here.)
 */

const modelRep = {
  studentId: "640612001",
  pendingStudentId: null,
  prefix: "นางสาว",
  firstName: "สมหญิง",
  lastName: "ดี",
  cohort: "ปริญญาโท", // เครือข่าย (network)
  generation: 5, // รุ่นที่ (generation)
  major: "การพยาบาลเด็ก",
};

const stringifyRow = (row: Record<string, string | number>): Record<string, string> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]));

describe("MODELREP_EXPORT_COLUMNS", () => {
  it("matches the model-representatives management table order (data columns only)", () => {
    expect([...MODELREP_EXPORT_COLUMNS]).toEqual([
      "เครือข่าย",
      "รุ่นที่",
      "รหัสนักศึกษา",
      "สาขาวิชา",
      "คำนำหน้า",
      "ชื่อ",
      "นามสกุล",
    ]);
  });

  it("does not export the row-number or actions columns", () => {
    expect(MODELREP_EXPORT_COLUMNS).not.toContain("ลำดับ");
    expect(MODELREP_EXPORT_COLUMNS).not.toContain("จัดการ");
  });
});

describe("modelRepToExportRow", () => {
  it("emits keys in the exact MODELREP_EXPORT_COLUMNS order", () => {
    expect(Object.keys(modelRepToExportRow(modelRep))).toEqual([...MODELREP_EXPORT_COLUMNS]);
  });

  it("maps the inverted fields correctly (เครือข่าย←cohort, รุ่นที่←generation)", () => {
    const row = modelRepToExportRow(modelRep);
    // NOT the sibling-entity mapping (cohort→รุ่นที่). Here cohort IS เครือข่าย.
    expect(row["เครือข่าย"]).toBe("ปริญญาโท");
    expect(row["รุ่นที่"]).toBe(5);
  });

  it("falls back to pendingStudentId when studentId is absent", () => {
    const row = modelRepToExportRow({ ...modelRep, studentId: null, pendingStudentId: "PENDING-001" });
    expect(row["รหัสนักศึกษา"]).toBe("PENDING-001");
  });
});

describe("model-representatives export → import round-trip", () => {
  it("an exported row re-parses to the same fields (inversion preserved on the way back)", () => {
    const exported = stringifyRow(modelRepToExportRow(modelRep));
    const { data, error } = parseModelRepRow(exported, 2);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      attemptedStudentId: "640612001",
      prefix: "นางสาว",
      firstName: "สมหญิง",
      lastName: "ดี",
      cohort: "ปริญญาโท", // เครือข่าย → cohort
      generation: 5, // รุ่นที่ → generation
    });
  });

  it("parses regardless of column order (the parser is header-keyed)", () => {
    const exported = stringifyRow(modelRepToExportRow(modelRep));
    const shuffled: Record<string, string> = {};
    for (const key of Object.keys(exported).reverse()) {
      shuffled[key] = exported[key];
    }
    const { data, error } = parseModelRepRow(shuffled, 2);
    expect(error).toBeNull();
    expect(data!.cohort).toBe("ปริญญาโท");
    expect(data!.generation).toBe(5);
  });

  it("accepts the legacy ลำดับรุ่น header too (existing exports still parse)", () => {
    const legacyRow: Record<string, string> = {
      "รหัสนักศึกษา": "640612001",
      "คำนำหน้า": "นางสาว",
      "ชื่อ": "สมหญิง",
      "นามสกุล": "ดี",
      "เครือข่าย": "ปริญญาโท",
      "ลำดับรุ่น": "5",
    };
    const { data, error } = parseModelRepRow(legacyRow, 2);
    expect(error).toBeNull();
    expect(data!.generation).toBe(5);
  });

  it("ignores the สาขาวิชา column (major is alumni-derived, not column-sourced)", () => {
    const exported = stringifyRow(modelRepToExportRow(modelRep));
    expect(exported["สาขาวิชา"]).toBe("การพยาบาลเด็ก");
    const { data } = parseModelRepRow(exported, 2);
    expect(data).not.toHaveProperty("major");
  });

  it("falls back to the legacy combined ชื่อ-สกุล column when ชื่อ/นามสกุล are absent", () => {
    const row: Record<string, string> = {
      "รหัสนักศึกษา": "640612001",
      "ชื่อ-สกุล": "นาย สมชาย ใจดี",
      "เครือข่าย": "ปริญญาตรี",
      "รุ่นที่": "3",
    };
    const { data, error } = parseModelRepRow(row, 2);
    expect(error).toBeNull();
    expect(data!.firstName).toBe("สมชาย");
    expect(data!.lastName).toBe("ใจดี");
  });

  it("rejects a row missing a required field or with a non-numeric รุ่นที่", () => {
    const exported = stringifyRow(modelRepToExportRow(modelRep));
    const missingNetwork = { ...exported, "เครือข่าย": "" };
    expect(parseModelRepRow(missingNetwork, 2).error?.message).toBe("ข้อมูลที่จำเป็นไม่ครบถ้วน");
    const badGen = { ...exported, "รุ่นที่": "fifth" };
    expect(parseModelRepRow(badGen, 2).error?.message).toBe("รุ่นที่ไม่ถูกต้อง");
  });
});

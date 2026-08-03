import { describe, it, expect } from "vitest";
import {
  ALUMNI_EXPORT_COLUMNS,
  alumniToExportRow,
  parseAlumniImportRow,
  alumniUpdatePayload,
} from "@/lib/alumni-excel";

/**
 * Pin the all-alumni Excel export/import contract:
 *   1. The export column layout mirrors the all-alumni management table (order +
 *      labels), with ลำดับ/จัดการ excluded.
 *   2. An exported row round-trips through the import parser (degreeLevel
 *      label↔enum, birthDate format↔strip, phones join↔parse, cohort,
 *      contactEmail), regardless of column order and for both the export and
 *      legacy header names.
 *   3. The import UPDATE payload protects the 4 export-only fields from blanking
 *      (the all-alumni analog of the awards empty-imageUrl behavior).
 */

/** A merged-alumni row shaped like the export mapper consumes. */
const merged = {
  studentId: "640612001",
  cohort: "รุ่น 5",
  prefix: "นางสาว",
  firstName: "สมหญิง",
  lastName: "ดี",
  degreeLevel: "MASTER",
  major: "การพยาบาลเด็ก",
  graduationYear: 2566,
  birthDate: "1997-12-01", // canonical YYYY-MM-DD
  email: null,
  contactEmail: "c@x.com",
  phones: ["0812345678", "0898765432"],
  homeAddress: "111 ถ.ห้วยแก้ว",
  remarks: "หมายเหตุทดสอบ",
};

/** Mimic an ExcelJS cell read: every value becomes a string. */
const stringifyRow = (row: Record<string, string | number>): Record<string, string> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]));

describe("ALUMNI_EXPORT_COLUMNS", () => {
  it("matches the all-alumni management table order (data columns only)", () => {
    expect([...ALUMNI_EXPORT_COLUMNS]).toEqual([
      "รหัสนักศึกษา",
      "รุ่น",
      "คำนำหน้า",
      "ชื่อ",
      "นามสกุล",
      "ระดับการศึกษา",
      "สาขาวิชา",
      "ปีสำเร็จการศึกษา",
      "วันเกิด",
      "อีเมลติดต่อ",
      "เบอร์โทร",
      "ที่อยู่ปัจจุบัน",
      "หมายเหตุ",
    ]);
  });

  it("does not export the row-number or actions columns", () => {
    expect(ALUMNI_EXPORT_COLUMNS).not.toContain("ลำดับ");
    expect(ALUMNI_EXPORT_COLUMNS).not.toContain("จัดการ");
  });
});

describe("alumniToExportRow", () => {
  it("emits keys in the exact ALUMNI_EXPORT_COLUMNS order", () => {
    expect(Object.keys(alumniToExportRow(merged))).toEqual([...ALUMNI_EXPORT_COLUMNS]);
  });

  it("maps the degreeLevel enum to its Thai label", () => {
    expect(alumniToExportRow(merged)["ระดับการศึกษา"]).toBe("ปริญญาโท");
  });

  it("renders วันเกิด as Thai DD-MM-YYYY Buddhist", () => {
    expect(alumniToExportRow(merged)["วันเกิด"]).toBe("01-12-2540");
  });

  it("joins phones and falls back from contactEmail to email", () => {
    const row = alumniToExportRow(merged);
    expect(row["เบอร์โทร"]).toBe("0812345678, 0898765432");
    expect(row["อีเมลติดต่อ"]).toBe("c@x.com");
    const noContact = alumniToExportRow({ ...merged, contactEmail: null, email: "auth@x.com" });
    expect(noContact["อีเมลติดต่อ"]).toBe("auth@x.com");
  });
});

describe("alumni export → import round-trip", () => {
  it("an exported row re-parses to the same fields (degreeLevel/birthDate/phones round-trip)", () => {
    const exported = stringifyRow(alumniToExportRow(merged));
    const { data, error } = parseAlumniImportRow(exported, 2);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      studentId: "640612001",
      prefix: "นางสาว",
      firstName: "สมหญิง",
      lastName: "ดี",
      cohort: "รุ่น 5",
      degreeLevel: "MASTER", // Thai label round-trips back to the enum
      major: "การพยาบาลเด็ก",
      graduationYear: 2566,
      birthDate: "01122540", // DD-MM-YYYY Buddhist → stripped to stored DDMMYYYY
      contactEmail: "c@x.com",
      phones: ["0812345678", "0898765432"],
      homeAddress: "111 ถ.ห้วยแก้ว",
      remarks: "หมายเหตุทดสอบ",
    });
  });

  it("parses regardless of column order (the parser is header-keyed)", () => {
    const exported = stringifyRow(alumniToExportRow(merged));
    const shuffled: Record<string, string> = {};
    for (const key of Object.keys(exported).reverse()) {
      shuffled[key] = exported[key];
    }
    const { data, error } = parseAlumniImportRow(shuffled, 2);
    expect(error).toBeNull();
    expect(data!.studentId).toBe("640612001");
    expect(data!.degreeLevel).toBe("MASTER");
  });

  it("accepts the legacy header names too (existing/legacy imports still parse)", () => {
    const legacyRow: Record<string, string> = {
      "รหัสนักศึกษา": "640612001",
      "คำนำหน้า": "นางสาว",
      "ชื่อ": "สมหญิง",
      "นามสกุล": "ดี",
      "รุ่น/สาขา": "รุ่น 5 การพยาบาล", // legacy combined column
      "อีเมล": "legacy@x.com", // legacy contact-email column
      "เบอร์โทร": "0812345678",
    };
    const { data, error } = parseAlumniImportRow(legacyRow, 2);
    expect(error).toBeNull();
    expect(data!.cohort).toBe("รุ่น 5 การพยาบาล");
    expect(data!.contactEmail).toBe("legacy@x.com");
  });

  it("rejects a row missing a required field or with a non-numeric studentId", () => {
    const exported = stringifyRow(alumniToExportRow(merged));
    const missingName = { ...exported, "ชื่อ": "" };
    expect(parseAlumniImportRow(missingName, 2).error?.message).toBe("ข้อมูลที่จำเป็นไม่ครบถ้วน");
    const badId = { ...exported, "รหัสนักศึกษา": "abc" };
    expect(parseAlumniImportRow(badId, 2).error?.message).toBe("รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น");
  });
});

describe("alumniUpdatePayload — export-only fields are not blanked", () => {
  const coreRecord = {
    studentId: "640612001",
    prefix: "นางสาว",
    firstName: "สมหญิง",
    lastName: "ดี",
    cohort: "รุ่น 5",
    degreeLevel: "MASTER" as const,
    contactEmail: "c@x.com",
    phones: ["0812345678"],
    homeAddress: "111 ถ.ห้วยแก้ว",
  };

  it("omits the 4 export-only fields when blank (preserves existing on update)", () => {
    const payload = alumniUpdatePayload({ ...coreRecord, major: null, graduationYear: null, birthDate: null, remarks: null });
    // The 8 core fields are always written.
    expect(payload).toHaveProperty("prefix");
    expect(payload).toHaveProperty("firstName");
    expect(payload).toHaveProperty("lastName");
    expect(payload).toHaveProperty("cohort");
    expect(payload).toHaveProperty("degreeLevel");
    expect(payload).toHaveProperty("contactEmail");
    expect(payload).toHaveProperty("phones");
    expect(payload).toHaveProperty("homeAddress");
    // The 4 export-only fields are omitted → Prisma leaves them untouched.
    expect(payload).not.toHaveProperty("major");
    expect(payload).not.toHaveProperty("graduationYear");
    expect(payload).not.toHaveProperty("birthDate");
    expect(payload).not.toHaveProperty("remarks");
  });

  it("includes the 4 export-only fields when the row provides them", () => {
    const payload = alumniUpdatePayload({
      ...coreRecord,
      major: "การพยาบาลเด็ก",
      graduationYear: 2566,
      birthDate: "01122540",
      remarks: "หมายเหตุ",
    });
    expect(payload.major).toBe("การพยาบาลเด็ก");
    expect(payload.graduationYear).toBe(2566);
    expect(payload.birthDate).toBe("01122540");
    expect(payload.remarks).toBe("หมายเหตุ");
  });
});

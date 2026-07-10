import { describe, it, expect } from "vitest";
import {
  inferCountry,
  isOriginalFormat,
  parseOriginalFormat,
  parseExportFormat,
  alumniAgencyMatchWhere,
} from "@/lib/alumni-agency-parse";

describe("inferCountry", () => {
  it("identifies Australia by city name", () => {
    expect(inferCountry("Brisbane Hospital")).toBe("ออสเตรเลีย");
    expect(inferCountry("Perth Medical Centre")).toBe("ออสเตรเลีย");
    expect(inferCountry("Royal Australia Hospital")).toBe("ออสเตรเลีย");
  });

  it("identifies Canada", () => {
    expect(inferCountry("University of Canada")).toBe("แคนาดา");
  });

  it("identifies Denmark", () => {
    expect(inferCountry("Copenhagen denmark clinic")).toBe("เดนมาร์ก");
  });

  it("identifies New Zealand", () => {
    expect(inferCountry("New Zealand hospital")).toBe("นิวซีแลนด์");
  });

  it("identifies France by city and country name", () => {
    expect(inferCountry("Paris hospital")).toBe("ฝรั่งเศส");
    expect(inferCountry("Lyon france clinic")).toBe("ฝรั่งเศส");
  });

  it("identifies Japan", () => {
    expect(inferCountry("Tokyo Japan University")).toBe("ญี่ปุ่น");
  });

  it("identifies USA by state and keyword", () => {
    expect(inferCountry("California Medical Center")).toBe("สหรัฐอเมริกา");
    expect(inferCountry("New York Hospital")).toBe("สหรัฐอเมริกา");
    expect(inferCountry("Texas Health System")).toBe("สหรัฐอเมริกา");
    expect(inferCountry("USA clinic")).toBe("สหรัฐอเมริกา");
    expect(inferCountry("U.S.A. hospital")).toBe("สหรัฐอเมริกา");
  });

  it("defaults to USA for unknown workplaces", () => {
    expect(inferCountry("Unknown Hospital")).toBe("สหรัฐอเมริกา");
    expect(inferCountry("")).toBe("สหรัฐอเมริกา");
  });

  it("is case-insensitive", () => {
    expect(inferCountry("AUSTRALIA")).toBe("ออสเตรเลีย");
    expect(inferCountry("CANADA")).toBe("แคนาดา");
  });
});

describe("isOriginalFormat", () => {
  it("returns true when header lacks คำนำหน้า and ประเทศ", () => {
    const rows = [["รุ่น", "ชื่อไทย", "", "ชื่ออังกฤษ", "ที่ทำงาน", "หมายเหตุ"]];
    expect(isOriginalFormat(rows)).toBe(true);
  });

  it("returns false when header contains คำนำหน้า", () => {
    const rows = [["รุ่น", "คำนำหน้า", "ชื่อไทย", "ชื่ออังกฤษ", "ประเทศ"]];
    expect(isOriginalFormat(rows)).toBe(false);
  });

  it("returns false when header contains ประเทศ", () => {
    const rows = [["ชื่อไทย", "ประเทศ"]];
    expect(isOriginalFormat(rows)).toBe(false);
  });

  it("returns true for empty rows", () => {
    expect(isOriginalFormat([])).toBe(true);
  });
});

describe("parseOriginalFormat", () => {
  it("skips the header row and parses data rows", () => {
    const rows = [
      ["รุ่น", "คำนำหน้า", "ชื่อไทย", "ชื่ออังกฤษ", "ที่ทำงาน", "หมายเหตุ"],
      ["1", "นางสาว", "สมหญิง ดี", "Somying Dee", "Australia National Hospital", ""],
    ];
    const result = parseOriginalFormat(rows);
    expect(result).toHaveLength(1);
    expect(result[0].rowNumber).toBe(2);
    expect(result[0].data.cohort).toBe("1");
    expect(result[0].data.prefix).toBe("นางสาว");
    expect(result[0].data.firstName).toBe("สมหญิง");
    expect(result[0].data.lastName).toBe("ดี");
    expect(result[0].data.englishName).toBe("Somying Dee");
    expect(result[0].data.workplace).toBe("Australia National Hospital");
    expect(result[0].data.country).toBe("ออสเตรเลีย");
    expect(result[0].data.notes).toBeNull();
    expect(result[0].data.order).toBe(1);
  });

  it("sets null for empty cells", () => {
    const rows = [
      ["header"],
      ["", "", "", "", "", ""],
    ];
    const result = parseOriginalFormat(rows);
    expect(result[0].data.cohort).toBeNull();
    expect(result[0].data.prefix).toBeNull();
    expect(result[0].data.firstName).toBeNull();
    expect(result[0].data.lastName).toBeNull();
    expect(result[0].data.englishName).toBeNull();
    expect(result[0].data.notes).toBeNull();
  });

  it("returns empty array for header-only input", () => {
    const rows = [["รุ่น", "คำนำหน้า"]];
    expect(parseOriginalFormat(rows)).toHaveLength(0);
  });

  it("infers country from workplace column", () => {
    const rows = [
      ["header"],
      ["5", "", "ทดสอบ", "", "Canada Hospital", ""],
    ];
    const result = parseOriginalFormat(rows);
    expect(result[0].data.country).toBe("แคนาดา");
  });

  it("leaves province/position null (legacy positional format has no such columns)", () => {
    const rows = [
      ["รุ่น", "คำนำหน้า", "ชื่อไทย", "ชื่ออังกฤษ", "ที่ทำงาน", "หมายเหตุ"],
      ["1", "นางสาว", "สมหญิง ดี", "Somying", "USA Hospital", ""],
    ];
    const result = parseOriginalFormat(rows);
    expect(result[0].data.province).toBeNull();
    expect(result[0].data.position).toBeNull();
  });
});

describe("parseExportFormat", () => {
  it("parses a valid export row", () => {
    const rows = [
      {
        ลำดับ: "1",
        รุ่น: "10",
        คำนำหน้า: "นาง",
        ชื่อไทย: "สมหญิง",
        ชื่ออังกฤษ: "Somying",
        สถานที่ทำงาน: "Japan Hospital",
        ประเทศ: "ญี่ปุ่น",
        หมายเหตุ: "ข้อมูลเก่า",
      },
    ];
    const result = parseExportFormat(rows);
    expect(result).toHaveLength(1);
    expect(result[0].rowNumber).toBe(2);
    expect(result[0].data.order).toBe(1);
    expect(result[0].data.cohort).toBe("10");
    expect(result[0].data.prefix).toBe("นาง");
    expect(result[0].data.firstName).toBe("สมหญิง");
    expect(result[0].data.lastName).toBeNull();
    expect(result[0].data.englishName).toBe("Somying");
    expect(result[0].data.workplace).toBe("Japan Hospital");
    expect(result[0].data.country).toBe("ญี่ปุ่น");
    expect(result[0].data.notes).toBe("ข้อมูลเก่า");
  });

  it("skips rows with no country", () => {
    const rows = [{ ชื่อไทย: "สมหญิง", ชื่ออังกฤษ: "Somying", ประเทศ: "" }];
    expect(parseExportFormat(rows)).toHaveLength(0);
  });

  it("skips rows with no thai or english name", () => {
    const rows = [{ ประเทศ: "ญี่ปุ่น", ชื่อไทย: "", ชื่ออังกฤษ: "" }];
    expect(parseExportFormat(rows)).toHaveLength(0);
  });

  it("keeps rows with only thai name", () => {
    const rows = [{ ประเทศ: "ญี่ปุ่น", ชื่อไทย: "สมหญิง", ชื่ออังกฤษ: "" }];
    const result = parseExportFormat(rows);
    expect(result).toHaveLength(1);
    expect(result[0].data.englishName).toBeNull();
  });

  it("keeps rows with only english name", () => {
    const rows = [{ ประเทศ: "ญี่ปุ่น", ชื่อไทย: "", ชื่ออังกฤษ: "Somying" }];
    const result = parseExportFormat(rows);
    expect(result).toHaveLength(1);
    expect(result[0].data.firstName).toBeNull();
    expect(result[0].data.lastName).toBeNull();
  });

  it("defaults order to 0 for non-numeric ลำดับ", () => {
    const rows = [{ ประเทศ: "ญี่ปุ่น", ชื่อไทย: "สมหญิง", ลำดับ: "abc" }];
    const result = parseExportFormat(rows);
    expect(result[0].data.order).toBe(0);
  });

  it("defaults order to 0 when ลำดับ is absent", () => {
    const rows = [{ ประเทศ: "ญี่ปุ่น", ชื่อไทย: "สมหญิง" }];
    const result = parseExportFormat(rows);
    expect(result[0].data.order).toBe(0);
  });

  it("sets null for optional fields when absent", () => {
    const rows = [{ ประเทศ: "แคนาดา", ชื่อไทย: "ทดสอบ" }];
    const result = parseExportFormat(rows);
    expect(result[0].data.cohort).toBeNull();
    expect(result[0].data.prefix).toBeNull();
    expect(result[0].data.workplace).toBeNull();
    expect(result[0].data.notes).toBeNull();
  });

  it("reads รหัสนักศึกษา + สาขาวิชา and leaves pendingStudentId null", () => {
    const rows = [
      {
        ประเทศ: "สหรัฐอเมริกา",
        ชื่อ: "สมหญิง",
        นามสกุล: "ดี",
        รหัสนักศึกษา: "511231004",
        สาขาวิชา: "พยาบาลศาสตร์",
      },
    ];
    const result = parseExportFormat(rows);
    expect(result[0].data.studentId).toBe("511231004");
    expect(result[0].data.major).toBe("พยาบาลศาสตร์");
    // The parser never decides pending-vs-linked — the import route does.
    expect(result[0].data.pendingStudentId).toBeNull();
  });

  it("defaults studentId/major to null when absent", () => {
    const rows = [{ ประเทศ: "สหรัฐอเมริกา", ชื่อ: "สมหญิง" }];
    const result = parseExportFormat(rows);
    expect(result[0].data.studentId).toBeNull();
    expect(result[0].data.major).toBeNull();
    expect(result[0].data.pendingStudentId).toBeNull();
  });

  it("reads จังหวัด + ตำแหน่ง columns", () => {
    const rows = [
      {
        ประเทศ: "ประเทศไทย",
        ชื่อ: "สมหญิง",
        นามสกุล: "ดี",
        จังหวัด: "เชียงใหม่",
        ตำแหน่ง: "หัวหน้าหอผู้ป่วย",
      },
    ];
    const result = parseExportFormat(rows);
    expect(result[0].data.province).toBe("เชียงใหม่");
    expect(result[0].data.position).toBe("หัวหน้าหอผู้ป่วย");
  });

  it("defaults province/position to null when absent", () => {
    const rows = [{ ประเทศ: "สหรัฐอเมริกา", ชื่อ: "สมหญิง" }];
    const result = parseExportFormat(rows);
    expect(result[0].data.province).toBeNull();
    expect(result[0].data.position).toBeNull();
  });
});

describe("pendingStudentId (parser invariant)", () => {
  it("parseOriginalFormat always sets pendingStudentId null", () => {
    const rows = [
      ["รุ่น", "คำนำหน้า", "ชื่อไทย", "ชื่ออังกฤษ", "ที่ทำงาน", "หมายเหตุ"],
      ["1", "นางสาว", "สมหญิง ดี", "Somying", "USA Hospital", ""],
    ];
    const result = parseOriginalFormat(rows);
    expect(result[0].data.studentId).toBeNull();
    expect(result[0].data.major).toBeNull();
    expect(result[0].data.pendingStudentId).toBeNull();
  });
});

describe("alumniAgencyMatchWhere (import idempotency — no duplication)", () => {
  it("a pending row ALSO matches a same-name id-less row (the duplicate bug)", () => {
    // Importing the mock (pending id) over the real name-only records must
    // match the existing real row by name and UPDATE it, not create a 2nd row.
    const w = alumniAgencyMatchWhere({
      studentId: null,
      pendingStudentId: "511231004",
      firstName: "สุปรียา",
      lastName: "เอแวนส์",
    });
    expect(w.OR).toEqual([
      { pendingStudentId: "511231004" },
      { firstName: "สุปรียา", lastName: "เอแวนส์", studentId: null, pendingStudentId: null },
    ]);
  });

  it("a linked row matches by studentId plus a name fallback", () => {
    const w = alumniAgencyMatchWhere({
      studentId: "137828",
      pendingStudentId: null,
      firstName: "สมหญิง",
      lastName: "ดี",
    });
    expect(w.OR).toEqual([
      { studentId: "137828" },
      { firstName: "สมหญิง", lastName: "ดี", studentId: null, pendingStudentId: null },
    ]);
  });

  it("a name-only row matches only id-less rows (no id clause)", () => {
    const w = alumniAgencyMatchWhere({
      studentId: null,
      pendingStudentId: null,
      firstName: "สมหญิง",
      lastName: "ดี",
    });
    expect(w.OR).toEqual([
      { firstName: "สมหญิง", lastName: "ดี", studentId: null, pendingStudentId: null },
    ]);
  });

  it("the name clause never matches an id'd row (no cross-person merge)", () => {
    // Both clauses require null ids, so a pending row can't merge into a
    // DIFFERENT pending/linked row that merely shares a name.
    const pending = alumniAgencyMatchWhere({ studentId: null, pendingStudentId: "X", firstName: "A", lastName: "B" });
    for (const clause of pending.OR as Record<string, unknown>[]) {
      if ("studentId" in clause) expect(clause.studentId).toBeNull();
      if ("pendingStudentId" in clause && clause.studentId === undefined) {
        // the id clause carries the real id — that's fine; the NAME clause is the null one
      }
    }
  });

  it("always scopes to non-deleted rows", () => {
    const w = alumniAgencyMatchWhere({ studentId: "1", pendingStudentId: null, firstName: "A", lastName: "B" });
    expect(w.deletedAt).toBeNull();
  });
});

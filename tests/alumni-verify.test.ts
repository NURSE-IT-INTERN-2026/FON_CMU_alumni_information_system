import { describe, it, expect } from "vitest";
import {
  normalizeFormBirthDate,
  normalizeCmuBirthday,
  formatBirthDateThai,
  birthDatesMatch,
  normalizeName,
  normalizeYear,
  isYearLike,
  cmuLevelToDegree,
  matchCmuGraduate,
} from "../lib/alumni-verify";
import type { CmuGraduate } from "../lib/cmu-registrar";

describe("normalizeFormBirthDate", () => {
  it("converts Buddhist DDMMYYYY to Gregorian YYYY-MM-DD", () => {
    expect(normalizeFormBirthDate("01122540")).toBe("1997-12-01"); // 2540 - 543 = 1997
  });
  it("keeps Gregorian years < 2400 as-is", () => {
    expect(normalizeFormBirthDate("15011997")).toBe("1997-01-15");
  });
  it("ignores non-digit characters", () => {
    expect(normalizeFormBirthDate("01-12-2540")).toBe("1997-12-01");
  });
  it("returns null for invalid input", () => {
    expect(normalizeFormBirthDate("")).toBeNull();
    expect(normalizeFormBirthDate("12345")).toBeNull();
    expect(normalizeFormBirthDate(null)).toBeNull();
  });
});

describe("normalizeCmuBirthday", () => {
  it("parses DD-MM-YYYY Gregorian", () => {
    expect(normalizeCmuBirthday("01-12-1997")).toBe("1997-12-01");
  });
  it("accepts slash and dot separators", () => {
    expect(normalizeCmuBirthday("01/12/1997")).toBe("1997-12-01");
    expect(normalizeCmuBirthday("01.12.1997")).toBe("1997-12-01");
  });
  it("accepts digit-only DDMMYYYY", () => {
    expect(normalizeCmuBirthday("01121997")).toBe("1997-12-01");
  });
  it("pads single-digit day/month", () => {
    expect(normalizeCmuBirthday("5-1-1997")).toBe("1997-01-05");
  });
  it("returns null for invalid input", () => {
    expect(normalizeCmuBirthday("")).toBeNull();
    expect(normalizeCmuBirthday("not-a-date")).toBeNull();
    expect(normalizeCmuBirthday(null)).toBeNull();
  });
});

describe("formatBirthDateThai", () => {
  it("formats YYYY-MM-DD as DD-MM-YYYY Buddhist (+543)", () => {
    expect(formatBirthDateThai("1997-12-01")).toBe("01-12-2540");
    expect(formatBirthDateThai("1952-07-11")).toBe("11-07-2495");
  });
  it("ignores a trailing time component", () => {
    expect(formatBirthDateThai("1997-12-01T00:00:00.000Z")).toBe("01-12-2540");
  });
  it("returns null for missing or non-date input", () => {
    expect(formatBirthDateThai(null)).toBeNull();
    expect(formatBirthDateThai("")).toBeNull();
    expect(formatBirthDateThai("not-a-date")).toBeNull();
  });
});

describe("birthDatesMatch", () => {
  it("matches form Buddhist DDMMYYYY with CMU DD-MM-YYYY", () => {
    expect(birthDatesMatch("01122540", "01-12-1997")).toBe(true);
  });
  it("rejects mismatches", () => {
    expect(birthDatesMatch("01122540", "02-12-1997")).toBe(false);
    expect(birthDatesMatch("02122540", "01-12-1997")).toBe(false);
  });
});

describe("name + year helpers", () => {
  it("normalizes names (case + whitespace), idempotent for Thai", () => {
    expect(normalizeName("  Som  Sak ")).toBe("som sak");
    expect(normalizeName("สมหญิง")).toBe("สมหญิง");
  });
  it("detects year-like values", () => {
    expect(isYearLike("2569")).toBe(true);
    expect(isYearLike("รุ่น 1")).toBe(false);
  });
  it("extracts digits for year comparison", () => {
    expect(normalizeYear("2569")).toBe("2569");
    expect(normalizeYear("2,569")).toBe("2569");
  });
});

describe("cmuLevelToDegree", () => {
  it("maps level_id (+ major) to degree", () => {
    expect(cmuLevelToDegree("5")).toBe("DOCTORAL");
    expect(cmuLevelToDegree("3")).toBe("MASTER");
    expect(cmuLevelToDegree("1")).toBe("BACHELOR");
    expect(cmuLevelToDegree("2")).toBe("NURSING_ASSISTANT");
    expect(cmuLevelToDegree("0", "ประกาศนียบัตรผู้ช่วยพยาบาล")).toBe("NURSING_ASSISTANT");
    expect(cmuLevelToDegree("0", "อื่นๆ")).toBe("ASSOCIATE");
    expect(cmuLevelToDegree(undefined)).toBe("BACHELOR");
  });
});

describe("matchCmuGraduate", () => {
  const grad: CmuGraduate = {
    student_id: "512045001",
    birthday: "01-12-1997",
    cmuitaccount: "",
    sex_id: "",
    name_th: "สมหญิง",
    middle_name_th: "",
    surname_th: "รักเรียน",
    name_en: "",
    middle_name_en: "",
    surname_en: "",
    level_id: "1",
    faculty_id: "12",
    major_id: "",
    major_name_th: "",
    major_sub_name_th: "",
    curriculum_id: "",
    grad_date: "",
    grad_year: "2560",
    grad_semester: "",
    study_time_id: "",
    plan_id: "",
    plan_name_th: "",
    std_phone: "",
    std_mobile: "",
    grad_school: "",
    grad_province: "",
    grad_program: "",
    grad_gpa: "",
    adm_type: "",
  };
  const input = {
    studentId: "512045001",
    cohort: "2560",
    firstName: "สมหญิง",
    maidenLastName: "รักเรียน",
    birthDate: "01122540",
  };

  it("matches when all 5 fields align", () => {
    expect(matchCmuGraduate(grad, input)).toBe(true);
  });
  it("is whitespace/case tolerant on names", () => {
    expect(matchCmuGraduate(grad, { ...input, firstName: " สมหญิง " })).toBe(true);
  });
  it("rejects wrong studentId", () => {
    expect(matchCmuGraduate(grad, { ...input, studentId: "999" })).toBe(false);
  });
  it("rejects wrong name", () => {
    expect(matchCmuGraduate(grad, { ...input, maidenLastName: "อื่นๆ" })).toBe(false);
  });
  it("rejects wrong graduation year", () => {
    expect(matchCmuGraduate(grad, { ...input, cohort: "2561" })).toBe(false);
  });
  it("rejects wrong birthday", () => {
    expect(matchCmuGraduate(grad, { ...input, birthDate: "02122540" })).toBe(false);
  });
  it("matches when CMU birthday is missing (sparse data)", () => {
    expect(matchCmuGraduate({ ...grad, birthday: "" }, input)).toBe(true);
  });
  it("matches when CMU grad_year is missing (sparse data)", () => {
    expect(matchCmuGraduate({ ...grad, grad_year: "" }, input)).toBe(true);
  });
});

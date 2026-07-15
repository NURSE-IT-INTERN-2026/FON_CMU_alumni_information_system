import { describe, it, expect } from "vitest";
import { buildSignupVerification } from "../lib/signup-verification";
import type { CmuGraduate } from "../lib/cmu-registrar";

const submitted = {
  studentId: "51204567",
  firstName: "สมหญิง",
  lastName: "รักเรียน",
  birthDate: "01122540", // Buddhist → 1997-12-01
  cohort: "2560",
  degreeLevel: "BACHELOR" as const,
};

function makeCmu(overrides: Partial<CmuGraduate> = {}): CmuGraduate {
  return {
    student_id: "51204567",
    birthday: "01-12-1997",
    cmuitaccount: "",
    sex_id: "2",
    name_th: "สมหญิง",
    middle_name_th: "",
    surname_th: "รักเรียน",
    name_en: "",
    middle_name_en: "",
    surname_en: "",
    level_id: "1",
    faculty_id: "",
    major_id: "",
    major_name_th: "พยาบาลศาสตร์",
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
    ...overrides,
  };
}

describe("buildSignupVerification", () => {
  it("marks all fields ✓ when submitted matches CMU", () => {
    const v = buildSignupVerification(submitted, makeCmu(), true);
    expect(v.cmuConsulted).toBe(true);
    expect(v.cmuFound).toBe(true);
    expect(v.fields.studentId.match).toBe(true);
    expect(v.fields.firstName.match).toBe(true);
    expect(v.fields.lastName.match).toBe(true);
    expect(v.fields.birthDate.match).toBe(true);
    expect(v.fields.cohort.match).toBe(true);
    expect(v.fields.degreeLevel.match).toBe(true);
    expect(v.allMatchableMatch).toBe(true);
  });

  it("marks ✗ on a mismatched name and reports the count", () => {
    const v = buildSignupVerification(
      submitted,
      makeCmu({ name_th: "สมชาย" }),
      true,
    );
    expect(v.fields.firstName.match).toBe(false);
    expect(v.fields.lastName.match).toBe(true);
    expect(v.allMatchableMatch).toBe(false);
  });

  it("treats the degree level as a mismatch when CMU level differs", () => {
    // level_id "3" → MASTER, applicant chose BACHELOR
    const v = buildSignupVerification(
      submitted,
      makeCmu({ level_id: "3" }),
      true,
    );
    expect(v.fields.degreeLevel.match).toBe(false);
    expect(v.fields.degreeLevel.authoritative).toBe("MASTER");
  });

  it("reports null (unknown) for sparse CMU fields it omits", () => {
    const v = buildSignupVerification(
      submitted,
      makeCmu({ birthday: "", grad_year: "" }),
      true,
    );
    expect(v.fields.birthDate.match).toBeNull();
    expect(v.fields.cohort.match).toBeNull();
    // studentId/names/degree are still checkable and match → overall true.
    expect(v.allMatchableMatch).toBe(true);
  });

  it("records CMU-not-found without throwing", () => {
    const v = buildSignupVerification(submitted, null, true);
    expect(v.cmuConsulted).toBe(true);
    expect(v.cmuFound).toBe(false);
    expect(v.cmuSnapshot).toBeNull();
    expect(v.fields.studentId.match).toBeNull();
    expect(v.allMatchableMatch).toBeNull();
  });

  it("records CMU-unreachable (not consulted) with all-null verdicts", () => {
    const v = buildSignupVerification(submitted, null, false);
    expect(v.cmuConsulted).toBe(false);
    expect(v.cmuFound).toBe(false);
    expect(v.allMatchableMatch).toBeNull();
    // Submitted values are still echoed back for display.
    expect(v.fields.studentId.submitted).toBe("51204567");
  });

  it("stores the raw submitted values verbatim for re-verify", () => {
    const v = buildSignupVerification(submitted, makeCmu(), true);
    expect(v.submitted).toEqual(submitted);
  });

  it("normalizes trailing whitespace + case in the studentId/names", () => {
    const v = buildSignupVerification(
      submitted,
      makeCmu({ student_id: "  51204567  ", name_th: " สมหญิง " }),
      true,
    );
    expect(v.fields.studentId.match).toBe(true);
    expect(v.fields.firstName.match).toBe(true);
  });

  // ── Local-alumni fallback (CMU has no record, studentId exists locally) ──

  const localMatch = {
    studentId: "51204567",
    firstName: "สมหญิง",
    lastName: "รักเรียน",
    birthDate: "01122540", // Buddhist DDMMYYYY, same form format as submitted
    graduationYear: 2560,
    degreeLevel: "BACHELOR" as const,
  };

  it("falls back to the LOCAL record when CMU has no record, all match → green", () => {
    const v = buildSignupVerification(submitted, null, true, localMatch);
    expect(v.source).toBe("local");
    expect(v.cmuFound).toBe(false);
    expect(v.cmuConsulted).toBe(true);
    expect(v.fields.studentId.match).toBe(true);
    expect(v.fields.firstName.match).toBe(true);
    expect(v.fields.lastName.match).toBe(true);
    expect(v.fields.birthDate.match).toBe(true);
    expect(v.fields.cohort.match).toBe(true);
    expect(v.fields.degreeLevel.match).toBe(true);
    expect(v.allMatchableMatch).toBe(true);
    // The authoritative column surfaces the LOCAL record's graduation year.
    expect(v.fields.cohort.authoritative).toBe("2560");
  });

  it("flags mismatches against the LOCAL record (case 4)", () => {
    const v = buildSignupVerification(submitted, null, true, {
      ...localMatch,
      firstName: "สมชาย",
      graduationYear: 2559,
    });
    expect(v.source).toBe("local");
    expect(v.fields.firstName.match).toBe(false);
    expect(v.fields.cohort.match).toBe(false);
    expect(v.fields.lastName.match).toBe(true);
    expect(v.allMatchableMatch).toBe(false);
    // The authoritative column shows the LOCAL record's value.
    expect(v.fields.firstName.authoritative).toBe("สมชาย");
    expect(v.fields.cohort.authoritative).toBe("2559");
  });

  it("prefers CMU over local when both are available", () => {
    const v = buildSignupVerification(submitted, makeCmu(), true, localMatch);
    expect(v.source).toBe("cmu");
    expect(v.cmuFound).toBe(true);
  });

  it("returns source=null when CMU has no record AND no local record is passed", () => {
    const v = buildSignupVerification(submitted, null, true);
    expect(v.source).toBeNull();
    expect(v.cmuFound).toBe(false);
    expect(v.allMatchableMatch).toBeNull();
  });
});

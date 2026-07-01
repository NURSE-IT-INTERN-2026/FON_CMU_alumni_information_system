import { describe, it, expect } from "vitest";
import {
  cmuGraduateRowToShape,
  type CmuGraduateRow,
} from "../lib/cmu-registrar";

const fullRow: CmuGraduateRow = {
  studentId: "12345",
  nameTh: "สมชาย",
  surnameTh: "ใจดี",
  birthday: "01-12-2540",
  levelId: "1",
  majorNameTh: "พยาบาลศาสตร์",
  gradYear: "2563",
  sexId: "1",
  cmuitAccount: "som@cmu.ac.th",
  nameEn: "Somchai",
  surnameEn: "Jaidee",
  gradDate: "2020-03-20",
  deletedAt: null,
};

describe("cmuGraduateRowToShape", () => {
  it("maps the 12 persisted fields into the CmuGraduate shape", () => {
    const g = cmuGraduateRowToShape(fullRow);
    expect(g.student_id).toBe("12345");
    expect(g.name_th).toBe("สมชาย");
    expect(g.surname_th).toBe("ใจดี");
    expect(g.birthday).toBe("01-12-2540");
    expect(g.level_id).toBe("1");
    expect(g.major_name_th).toBe("พยาบาลศาสตร์");
    expect(g.grad_year).toBe("2563");
    expect(g.sex_id).toBe("1");
    expect(g.cmuitaccount).toBe("som@cmu.ac.th");
    expect(g.name_en).toBe("Somchai");
    expect(g.surname_en).toBe("Jaidee");
    expect(g.grad_date).toBe("2020-03-20");
  });

  it("coerces nullable enrichment fields to empty string (matching sparse live records)", () => {
    const sparse: CmuGraduateRow = {
      ...fullRow,
      sexId: null,
      cmuitAccount: null,
      nameEn: null,
      surnameEn: null,
      gradDate: null,
    };
    const g = cmuGraduateRowToShape(sparse);
    expect(g.sex_id).toBe("");
    expect(g.cmuitaccount).toBe("");
    expect(g.name_en).toBe("");
    expect(g.surname_en).toBe("");
    expect(g.grad_date).toBe("");
  });

  it("leaves the ~17 unpersisted fields undefined (consumers never read them)", () => {
    const g = cmuGraduateRowToShape(fullRow);
    expect(g.faculty_id).toBeUndefined();
    expect(g.middle_name_th).toBeUndefined();
    expect(g.middle_name_en).toBeUndefined();
    expect(g.major_id).toBeUndefined();
    expect(g.grad_gpa).toBeUndefined();
    expect(g.adm_type).toBeUndefined();
    expect(g.student_ids).toBeUndefined();
  });
});
